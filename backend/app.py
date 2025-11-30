from flask import Flask
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from marshmallow import Schema, fields, validate, validates, ValidationError, EXCLUDE
from datetime import date, datetime
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import func, text
import os
import pandas as pd
import io

class Base(DeclarativeBase):
    pass

# create SQLAlchemy instance
db = SQLAlchemy(model_class=Base)

app = Flask(__name__)
# Enable CORS for all routes so frontend can fetch both /api/* and direct endpoints like /client/<id>
CORS(app, resources={r"/*": {"origins": "*"}})

# load config from environment variables or a config file
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:Admin2025!@localhost:5432/backdoor_mission_database"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# initialize the database with the app
db.init_app(app)

# Ensure schema issues are corrected on startup (remove accidental unique constraint on client_id)
def fix_schema_constraints():
    try:
        with app.app_context():
            # Some environments/migrations accidentally created a unique constraint on client_id
            # which prevents multiple service records per client. Remove it if present.
            try:
                db.session.execute(text("ALTER TABLE washroom_records DROP CONSTRAINT IF EXISTS washroom_records_client_id_unique;"))
            except Exception:
                pass
            try:
                db.session.execute(text("DROP INDEX IF EXISTS washroom_records_client_id_idx;"))
            except Exception:
                pass
            # Remove accidental unique constraints on client_id for other service tables
            try:
                db.session.execute(text("ALTER TABLE coat_check_records DROP CONSTRAINT IF EXISTS coat_check_records_client_id_unique;"))
            except Exception:
                pass
            try:
                db.session.execute(text("DROP INDEX IF EXISTS coat_check_records_client_id_idx;"))
            except Exception:
                pass
            try:
                db.session.execute(text("ALTER TABLE sanctuary_records DROP CONSTRAINT IF EXISTS sanctuary_records_client_id_unique;"))
            except Exception:
                pass
            try:
                db.session.execute(text("DROP INDEX IF EXISTS sanctuary_records_client_id_idx;"))
            except Exception:
                pass
            try:
                db.session.execute(text("ALTER TABLE clinic_records DROP CONSTRAINT IF EXISTS clinic_records_client_id_unique;"))
            except Exception:
                pass
            try:
                db.session.execute(text("DROP INDEX IF EXISTS clinic_records_client_id_idx;"))
            except Exception:
                pass
            try:
                db.session.execute(text("ALTER TABLE safe_sleep_records DROP CONSTRAINT IF EXISTS safe_sleep_records_client_id_unique;"))
            except Exception:
                pass
            try:
                db.session.execute(text("DROP INDEX IF EXISTS safe_sleep_records_client_id_idx;"))
            except Exception:
                pass
            # Ensure the `date` column for safe_sleep_records stores full timestamps
            # (some older installs used DATE only which truncates time to midnight).
            try:
                db.session.execute(text("ALTER TABLE safe_sleep_records ALTER COLUMN date TYPE TIMESTAMP USING date::timestamp;"))
            except Exception:
                # if the column is already timestamp or the DB doesn't support the cast, ignore
                pass
            # Ensure time_out columns are nullable across service tables. Some migrations
            # accidentally set them NOT NULL which prevents creating records without time_out.
            try:
                db.session.execute(text("ALTER TABLE washroom_records ALTER COLUMN time_out DROP NOT NULL;"))
            except Exception:
                pass
            try:
                db.session.execute(text("ALTER TABLE coat_check_records ALTER COLUMN time_out DROP NOT NULL;"))
            except Exception:
                pass
            try:
                db.session.execute(text("ALTER TABLE sanctuary_records ALTER COLUMN time_out DROP NOT NULL;"))
            except Exception:
                pass
            db.session.commit()
    except Exception:
        # don't crash startup if we can't fix schema here; log to stdout
        print('Warning: could not verify or modify constraints')

# Run schema fix at import time (safe no-op if DB not available)
fix_schema_constraints()

# ---------------- MODELS ----------------
if 'Client' not in globals():
    class Client(db.Model):
        __tablename__ = "client"
        client_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
        full_name = db.Column(db.String(255), nullable=False)
        gender = db.Column(db.String(2), nullable=True)
        # optional secondary identifiers to help disambiguate clients
        nickname = db.Column(db.String(255), nullable=True)
        birth_year = db.Column(db.Integer, nullable=True)

if 'WashroomRecord' not in globals():
    class WashroomRecord(db.Model):
        __tablename__ = "washroom_records"
        washroom_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
        client_id = db.Column(db.Integer, db.ForeignKey('client.client_id'), nullable=False)
        washroom_type = db.Column(db.String(1), nullable=False) 
        time_in = db.Column(db.DateTime, nullable=False)
        time_out = db.Column(db.DateTime, nullable=True)
        date = db.Column(db.Date, nullable=False)

if 'CoatCheckRecord' not in globals():
    class CoatCheckRecord(db.Model):
        __tablename__ = "coat_check_records"
        check_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
        client_id = db.Column(db.Integer, db.ForeignKey('client.client_id'), nullable=False)
        bin_no = db.Column(db.Integer, nullable=False)
        time_in = db.Column(db.DateTime, nullable=False)
        time_out = db.Column(db.DateTime, nullable=True)
        date = db.Column(db.Date, nullable=False)

if 'SanctuaryRecord' not in globals():
    class SanctuaryRecord(db.Model):
        __tablename__ = "sanctuary_records"
        sanctuary_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
        client_id = db.Column(db.Integer, db.ForeignKey('client.client_id'), nullable=False)
        date = db.Column(db.Date, nullable=False)
        time_in = db.Column(db.DateTime, nullable=False)
        time_out = db.Column(db.DateTime, nullable=True)
        purpose_of_visit = db.Column(db.Text, nullable=True)
        if_serviced = db.Column(db.Boolean, nullable=False, default=False)

if 'ClinicRecord' not in globals():
    class ClinicRecord(db.Model):
        __tablename__ = "clinic_records"
        clinic_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
        client_id = db.Column(db.Integer, db.ForeignKey('client.client_id'), nullable=False)
        date = db.Column(db.Date, nullable=False)
        purpose_of_visit = db.Column(db.Text, nullable=True)

if 'SafeSleepRecord' not in globals():
    class SafeSleepRecord(db.Model):
        __tablename__ = "safe_sleep_records"
        sleep_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
        client_id = db.Column(db.Integer, db.ForeignKey('client.client_id'), nullable=False)
        bed_no = db.Column(db.Integer, nullable=True)
        is_occupied = db.Column(db.Boolean, nullable=False, default=False)
        # store full datetime so we can record the time the bed was occupied
        date = db.Column(db.DateTime, nullable=False)

if 'Activity' not in globals():
    class Activity(db.Model):
        __tablename__ = "activity_records"
        activity_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
        activity_name = db.Column(db.String(255), nullable=False)
        date = db.Column(db.Date, nullable=False)
        # optional start/end times for calendar placement
        start_time = db.Column(db.DateTime, nullable=True)
        end_time = db.Column(db.DateTime, nullable=True)
        # attendance count for the event
        attendance = db.Column(db.Integer, nullable=False, default=0)

if 'ClientActivity' not in globals():
    class ClientActivity(db.Model):
        __tablename__ = "client_activity"
        client_activity_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
        client_id = db.Column(db.Integer, db.ForeignKey('client.client_id'), nullable=False)
        activity_id = db.Column(db.Integer, db.ForeignKey('activity_records.activity_id'), nullable=False)
        date = db.Column(db.DateTime, nullable=False)
        # optional satisfaction score 1-10
        score = db.Column(db.Integer, nullable=True)

# ---------------- SCHEMAS ----------------
class ClientSchema(Schema):
    client_id = fields.Int(dump_only=True)
    full_name = fields.Str(required=True, validate=validate.Length(min=1))
    gender = fields.Str(required=False, validate=validate.Length(max=2), allow_none=True)
    nickname = fields.Str(required=False, allow_none=True)
    birth_year = fields.Int(required=False, allow_none=True, validate=validate.Range(min=1900, max=2100))

class WashroomSchema(Schema):
    washroom_id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    washroom_type = fields.Str(required=True)
    time_in = fields.DateTime(required=True)
    time_out = fields.DateTime(required=False)
    date = fields.Date(required=True)

    @validates("time_out")
    def validate_time_out(self, value, **kwargs):
        """
        Validates that time_out is after time_in if provided.
        If time_out is missing, just logs a warning instead of raising an error.
        """
        if value is None:
            print("Warning: time_out not provided for this record")
            
    @validates('washroom_type')
    def validate_washroom_type(self, value, **kwargs):
        valid_types = ['A', 'B']
        if value not in valid_types:
            raise ValidationError(f"washroom_type must be one of {valid_types}")

class CoatCheckSchema(Schema):
    # align field name with model primary key (check_id)
    check_id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    bin_no = fields.Int(required=True)
    time_in = fields.DateTime(required=True)
    time_out = fields.DateTime(required=False)
    date = fields.Date(required=True)

    @validates("time_out")
    def validate_time_out(self, value, **kwargs):
        """
        Validates that time_out is after time_in if provided.
        If time_out is missing, just logs a warning instead of raising an error.
        """
        if value is None:
            print("Warning: time_out not provided for this record")

    @validates('bin_no')
    def validate_bin_no(self, value, **kwargs):
        if value < 1 or value > 100:
            raise ValidationError("bin_no must be between 1 and 100")

class SanctuarySchema(Schema):
    sanctuary_id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    date = fields.Date(required=True)
    time_in = fields.DateTime(required=True)
    time_out = fields.DateTime(required=False)
    purpose_of_visit = fields.Str(required=False)
    if_serviced = fields.Bool(required=True)

    @validates("time_out")
    def validate_time_out(self, value, **kwargs):
        """
        Validates that time_out is after time_in if provided.
        If time_out is missing, just logs a warning instead of raising an error.
        """
        if value is None:
            print("Warning: time_out not provided for this record")

class ClinicSchema(Schema):
    clinic_id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    # make date optional on the payload so clients in different timezones
    # don't accidentally send a date that the server considers "in the future".
    # We'll default/normalize on the server side in the route handler.
    date = fields.Date(required=False)
    purpose_of_visit = fields.Str(required=False, validate=validate.Length(min=1))

    @validates('date')
    def validate_date(self, value, **kwargs):
        # only validate if value provided; do not raise here for future dates
        # because we'll clamp/normalize in the create handler to server's date.
        return

class SafeSleepSchema(Schema):
    sleep_id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    bed_no = fields.Int(required=False, allow_none=True)
    is_occupied = fields.Bool(required=False)
    # date stores both date and time (ISO datetime)
    date = fields.DateTime(required=True)

    @validates('date')
    def validate_date(self, value, **kwargs):
        from datetime import datetime, timezone
        # Accept both offset-aware and offset-naive datetimes.
        # If `value` has tzinfo, compare using UTC-aware "now";
        # otherwise compare using a naive now. This avoids
        # "can't compare offset-naive and offset-aware datetimes".
        tz = getattr(value, 'tzinfo', None)
        if tz is None:
            now = datetime.now()
            cmp_value = value
        else:
            # make both value and now aware in UTC for comparison
            now = datetime.now(timezone.utc)
            try:
                cmp_value = value.astimezone(timezone.utc)
            except Exception:
                # if astimezone fails for some reason, coerce tzinfo
                cmp_value = value.replace(tzinfo=timezone.utc)

        if cmp_value > now:
            raise ValidationError('date cannot be in the future')

    @validates('bed_no')
    def validate_bed_no(self, value, **kwargs):
        if value is None:
            return
        if value < 1 or value > 20:
            raise ValidationError('bed_no must be between 1 and 20')

class ActivitySchema(Schema):
    class Meta:
        unknown = EXCLUDE
    activity_id = fields.Int(dump_only=True)
    activity_name = fields.Str(required=True, validate=validate.Length(min=1))
    date = fields.Date(required=True)
    start_time = fields.DateTime(required=False, allow_none=True)
    end_time = fields.DateTime(required=False, allow_none=True)
    attendance = fields.Int(required=False, load_default=0)
    # color is a frontend-only UI preference and not stored server-side

class ClientActivitySchema(Schema):
    client_activity_id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    activity_id = fields.Int(required=True)
    date = fields.DateTime(required=True)
    score = fields.Int(required=False, allow_none=True, validate=validate.Range(min=1, max=10))

# ---------------- ROUTES ----------------
# testing
@app.route("/data_clean/client", methods=["POST"])
def clean_clients():
    # run simple cleaning operations inline to avoid import/app-context issues
    # 1) standardize client names
    clients = Client.query.all()
    standardized = 0
    for client in clients:
        clean_name = client.full_name.strip().title()
        if client.full_name != clean_name:
            client.full_name = clean_name
            standardized += 1

    # 2) remove duplicate clients (same full_name), keep lowest client_id
    duplicates = (
        db.session.query(Client.full_name, func.count(Client.client_id))
        .group_by(Client.full_name)
        .having(func.count(Client.client_id) > 1)
        .all()
    )
    removed = 0
    for name, cnt in duplicates:
        duplicates_to_delete = (
            Client.query.filter_by(full_name=name)
            .order_by(Client.client_id.asc())
            .offset(1)
            .all()
        )
        for dup in duplicates_to_delete:
            db.session.delete(dup)
            removed += 1

    db.session.commit()
    return jsonify({"standardized": standardized, "removed": removed}), 200

# exporting route into excel file for any table
@app.route("/export/<string:table_name>", methods=["GET"])
def export_table(table_name):
    # map table names to SQLAlchemy models
    models = {
        "client": Client,
        "washroom_records": WashroomRecord,
        "coat_check_records": CoatCheckRecord,
        "sanctuary_records": SanctuaryRecord,
        "safe_sleep_records": SafeSleepRecord,
        "clinic_records": ClinicRecord,
        "activity_records": Activity,
        "client_activity": ClientActivity
    }

    # validation if table exists
    if table_name not in models:
        return jsonify({"message": "Table not found"}), 404
    
    # fetch all rows from the table using SQLAlchemy
    model = models[table_name]
    query = model.query.all()

    # if table entry, return 404 code
    if not query:
        return jsonify({"message": "No data found in the table"}), 404
    
    # convert to pandas DataFrame
    try:
        df = pd.DataFrame([row.__dict__ for row in query])
        df.drop(columns=["_sa_instance_state"], inplace=True, errors='ignore')

        # export to excel in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, sheet_name=table_name[:31])  # Excel sheet names limited to 31 chars
        
        output.seek(0)
        # send file as response
        return send_file(
            output,
            as_attachment=True,
            download_name=f"{table_name}.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"message": "Error exporting table", "error": str(e)}), 500

# POST requests to create records

@app.route("/client", methods=["POST"])
def create_client():
    payload = request.json

    try:
        data = ClientSchema().load(payload)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    # Normalize full_name to capitalized initials (e.g. "ruby rose" -> "Ruby Rose")
    if data.get('full_name'):
        parts = [p for p in str(data['full_name']).strip().split() if p]
        data['full_name'] = ' '.join([p.capitalize() for p in parts])

    # Do not block creation on duplicate names. Duplicate detection should be
    # performed by the frontend using `/api/clients/suggest` while the staff is
    # typing. Create the client record with optional nickname and birth_year.
    client = Client(
        full_name=data.get('full_name'),
        gender=data.get('gender'),
        nickname=data.get('nickname'),
        birth_year=data.get('birth_year')
    )
    try:
        db.session.add(client)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Client created", "client_id": client.client_id}), 201


@app.route('/api/clients/suggest', methods=['GET'])
def suggest_clients():
    # Return up to 10 potential existing clients matching the provided query
    q = request.args.get('query', '')
    q = (q or '').strip()
    if not q:
        return jsonify([]), 200
    # case-insensitive contains match
    matches = Client.query.filter(Client.full_name.ilike(f"%{q}%"))
    matches = matches.limit(10).all()
    result = []
    for c in matches:
        result.append({
            'client_id': c.client_id,
            'full_name': c.full_name,
            'nickname': c.nickname,
            'birth_year': c.birth_year,
            'gender': c.gender
        })
    return jsonify(result), 200

@app.route("/washroom_records", methods=["POST"])
def create_washroom_record():
    payload = request.json

    try:
        data = WashroomSchema().load(payload)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # check if time_out > time_in
    if data.get("time_out") is not None and data["time_out"] <= data["time_in"]:
        return jsonify({"message": "time_out must be after time_in"}), 400

    # ensure client exists
    client = Client.query.get(data["client_id"])
    if not client:
        return jsonify({"message": "Client not found"}), 404
    # Ensure the requested washroom type is not currently occupied (an open record without time_out)
    occupied = WashroomRecord.query.filter_by(washroom_type=data.get('washroom_type')).filter(WashroomRecord.time_out == None).first()
    if occupied:
        return jsonify({"message": f"Washroom {data.get('washroom_type')} is currently occupied"}), 400

    was = WashroomRecord(**data)
    try:
        db.session.add(was)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Washroom record created", "washroom_id": was.washroom_id}), 201

@app.route("/coat_check_records", methods=["POST"])
def create_coat_check_record():
    payload = request.json

    try:
        data = CoatCheckSchema().load(payload)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # check if time_out > time_in
    if data.get("time_out") is not None and data["time_out"] <= data["time_in"]:
        return jsonify({"message": "time_out must be after time_in"}), 400
    
    # validate bin no
    if data.get("bin_no") is not None and (data["bin_no"] < 1 or data["bin_no"] > 100):
        return jsonify({"message": "bin_no must be between 1 and 100"}), 400

    
    # ensure client exists
    client = Client.query.get(data["client_id"])
    if not client:
        return jsonify({"message": "Client not found"}), 404
    
    # Ensure the requested bin is not currently occupied (an open record without time_out)
    occupied = CoatCheckRecord.query.filter_by(bin_no=data.get('bin_no')).filter(CoatCheckRecord.time_out == None).first()
    if occupied:
        return jsonify({"message": f"Bin {data.get('bin_no')} is currently occupied"}), 400
    
    coat = CoatCheckRecord(**data)
    try:
        db.session.add(coat)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Coat check record created", "check_id": coat.check_id}), 201    

@app.route("/sanctuary_records", methods=["POST"])
def create_sanctuary_record():
    payload = request.json or {}
    # defensive: remove any provided primary key before validation
    payload.pop('sanctuary_id', None)
    print("[DEBUG] create_sanctuary_record (second) payload:", payload)
    print("[DEBUG] create_sanctuary_record payload:", payload)

    try:
        data = SanctuarySchema().load(payload)
        print("[DEBUG] create_sanctuary_record marshalled data:", data)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # check if time_out > time_in
    if data.get("time_out") is not None and data["time_out"] <= data["time_in"]:
        return jsonify({"message": "time_out must be after time_in"}), 400
    
    # ensure client exists
    client = Client.query.get(data["client_id"])
    if not client:
        return jsonify({"message": "Client not found"}), 404
    # Defensive: construct a clean payload dict to avoid passing sanctuary_id
    clean = {
        'client_id': data.get('client_id'),
        'date': data.get('date'),
        'time_in': data.get('time_in'),
        'time_out': data.get('time_out'),
        'purpose_of_visit': data.get('purpose_of_visit'),
        'if_serviced': data.get('if_serviced', False)
    }

    sanc = SanctuaryRecord(**clean)
    try:
        db.session.add(sanc)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Sanctuary record created", "sanctuary_id": sanc.sanctuary_id}), 201

@app.route("/clinic_records", methods=["POST"])
def create_clinic_record():
    payload = request.json

    try:
        data = ClinicSchema().load(payload)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # ensure date/time is present; use current server time if missing
    from datetime import datetime
    if not data.get('date'):
        data['date'] = datetime.now()
    else:
        try:
            # if client submitted a future datetime (clock skew), clamp to now
            if data['date'] > datetime.now():
                data['date'] = datetime.now()
        except Exception:
            data['date'] = datetime.now()
    
    # ensure client exists
    client = Client.query.get(data["client_id"])
    if not client:
        return jsonify({"message": "Client not found"}), 404
    
    clinic = ClinicRecord(**data)
    try:
        db.session.add(clinic)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Clinic record created", "clinic_id": clinic.clinic_id}), 201

@app.route("/safe_sleep_records", methods=["POST"])
def create_safe_sleep_record():
    payload = request.json

    try:
        data = SafeSleepSchema().load(payload)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # ensure client exists
    client = Client.query.get(data["client_id"])
    if not client:
        return jsonify({"message": "Client not found"}), 404

    # Prevent a client from occupying more than one bed at a time.
    # If a client already has an active occupied bed, do not allow creating
    # another occupied record for a different bed until the existing one is freed.
    from sqlalchemy import and_
    existing = SafeSleepRecord.query.filter_by(client_id=data["client_id"], is_occupied=True).first()
    if existing:
        # allow creating the same occupied record for the same bed_no only if it matches
        # otherwise block to prevent multiple concurrent occupied beds
        if not data.get("bed_no") or (existing.bed_no != data.get("bed_no")):
            return jsonify({"message": "Client is already occupying a bed", "sleep_id": existing.sleep_id}), 400
    
    # ensure bed_no/is_occupied defaults when not provided
    if 'is_occupied' not in data:
        # when frontend creates a safe-sleep record it implies occupancy
        data['is_occupied'] = True if data.get('bed_no') else False

    # ensure date/time is present (use current time if missing)
    from datetime import datetime
    if 'date' not in data or data['date'] is None:
        data['date'] = datetime.now()

    safe_sleep = SafeSleepRecord(**data)
    try:
        db.session.add(safe_sleep)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Safe sleep record created", "sleep_id": safe_sleep.sleep_id}), 201


@app.route("/activity", methods=["POST"])
def create_activity():
    payload = request.json

    try:
        data = ActivitySchema().load(payload)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    # validate start/end times when provided
    if data.get('start_time') is not None and data.get('end_time') is not None:
        try:
            if data['end_time'] <= data['start_time']:
                return jsonify({"message": "end_time must be after start_time"}), 400
        except Exception:
            return jsonify({"message": "Invalid start_time/end_time values"}), 400

    # defensive: ensure frontend-only UI fields don't crash model construction
    data.pop('color', None)
    # defensive: ensure frontend-only UI fields don't crash model construction
    data.pop('color', None)
    activity = Activity(**data)
    try:
        db.session.add(activity)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Activity created", "activity_id": activity.activity_id}), 201

@app.route("/client_activity", methods=["POST"])
def create_client_activity():
    payload = request.json or {}
    # Defensive: remove any provided primary key so DB autoincrement can work
    payload.pop('client_activity_id', None)
    print(f"[DEBUG] create_client_activity payload cleaned: keys={list(payload.keys())}")

    try:
        data = ClientActivitySchema().load(payload)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # ensure client exists
    client = Client.query.get(data["client_id"])
    if not client:
        return jsonify({"message": "Client not found"}), 404
    
    # ensure activity exists
    activity = Activity.query.get(data["activity_id"])
    if not activity:
        return jsonify({"message": "Activity not found"}), 404
    
    client_activity = ClientActivity(**data)
    try:
        db.session.add(client_activity)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Client activity created", "client_activity_id": client_activity.client_activity_id}), 201


# GET requests to get records

# get all clients
@app.route("/client", methods=["GET"])
def get_clients():
    full_name = request.args.get("full_name")
    query = Client.query

    if full_name:
        query = query.filter(Client.full_name.ilike(f"%{full_name}%"))
    clients = query.all()
    data = ClientSchema(many=True).dump(clients)
    return jsonify(data), 200

# get client by id
@app.route("/client/<int:client_id>", methods=["GET"])
def get_client(client_id):
    client = Client.query.get(client_id)
    if not client:
        return jsonify({"message": "Client not found"}), 404
    
    data = ClientSchema().dump(client)
    return jsonify(data), 200


# Backend compatibility endpoints for frontend
@app.route('/api/clients', methods=['GET'])
def api_get_clients():
    """Compatibility wrapper: supports `?query=` used by frontend SearchBar.
    Returns an array of clients matching `full_name` (case-insensitive contains).
    If no query provided, returns all clients (capped for safety).
    """
    query_param = request.args.get('query')
    q = Client.query
    if query_param:
        q = q.filter(Client.full_name.ilike(f"%{query_param}%"))
    # Safety: cap to 200 results to avoid huge responses
    clients = q.limit(200).all()
    data = ClientSchema(many=True).dump(clients)
    return jsonify(data), 200


@app.route('/api/clients/recent', methods=['GET'])
def api_recent_clients():
    """Return a small list of recent clients based on most recent service records.
    The endpoint aggregates recent records from service tables and returns
    unique clients ordered by most-recent service date. Each entry includes:
    { id, name, date, service }
    """
    try:
        limit = int(request.args.get('limit', 10))
    except Exception:
        limit = 10

    records = []

    # Helper to append records; prefer time_in if available for ordering
    def push_records(queryset, service_name, has_time_in=False):
        for r in queryset:
            # r may be a model instance
            rec_date = None
            rec_dt = None
            # Prefer explicit time_in if available
            if has_time_in and hasattr(r, 'time_in') and r.time_in is not None:
                rec_dt = r.time_in
            elif hasattr(r, 'date') and r.date is not None:
                # If the model's `date` is a datetime, use it directly. If it's a
                # plain date, convert to an end-of-day datetime so date-only
                # records (which have no time) sort after time-stamped records
                # from the same day.
                from datetime import datetime, time, date as _date, datetime as _dt
                try:
                    dval = r.date
                    if isinstance(dval, _dt):
                        rec_dt = dval
                    elif isinstance(dval, _date):
                        rec_dt = datetime.combine(dval, time.max)
                    else:
                        # fallback: try to coerce
                        rec_dt = datetime.combine(dval, time.max)
                except Exception:
                    # Last-resort fallback
                    from datetime import datetime as _dt2
                    rec_dt = _dt2.now()
            records.append({'client_id': r.client_id, 'datetime': rec_dt, 'date': getattr(r, 'date', None), 'service': service_name})

    # Collect recent records from different service tables
    push_records(CoatCheckRecord.query.order_by(CoatCheckRecord.date.desc()).limit(limit).all(), 'Coat Check', has_time_in=True)
    push_records(WashroomRecord.query.order_by(WashroomRecord.date.desc()).limit(limit).all(), 'Washroom', has_time_in=True)
    push_records(SanctuaryRecord.query.order_by(SanctuaryRecord.date.desc()).limit(limit).all(), 'Sanctuary', has_time_in=True)
    push_records(ClinicRecord.query.order_by(ClinicRecord.date.desc()).limit(limit).all(), 'Clinic', has_time_in=False)
    push_records(SafeSleepRecord.query.order_by(SafeSleepRecord.date.desc()).limit(limit).all(), 'Safe Sleep', has_time_in=False)
    push_records(ClientActivity.query.order_by(ClientActivity.date.desc()).limit(limit).all(), 'Activity', has_time_in=False)

    # Ensure all records have a datetime for ordering. If missing, set a very old fallback
    from datetime import datetime, timezone
    for r in records:
        # Ensure datetime values are timezone-naive so they can be compared/sorted
        if r['datetime'] is None:
            r['datetime'] = datetime.min
        else:
            dt_val = r['datetime']
            tzinfo = getattr(dt_val, 'tzinfo', None)
            if tzinfo is not None:
                try:
                    # convert to UTC then drop tzinfo to make naive
                    r['datetime'] = dt_val.astimezone(timezone.utc).replace(tzinfo=None)
                except Exception:
                    # fallback: strip tzinfo if astimezone fails
                    r['datetime'] = dt_val.replace(tzinfo=None)

    # Sort by datetime descending (fallback datetimes will appear last)
    records.sort(key=lambda x: x['datetime'], reverse=True)

    # Map records into output rows, resolving client name when possible.
    SERVICE_COLORS = {
        'Coat Check': '#FE2323',
        'Washroom': '#6ECAEE',
        'Sanctuary': '#D9F373',
        'Clinic': '#FA488F',
        'Safe Sleep': '#2C3B9C',
        'Activity': '#A8A8A8'
    }

    mapped = []
    for r in records:
        cid = r.get('client_id')
        client = Client.query.get(cid)
        name = client.full_name if client else f"Client #{cid}"
        date_str = r['date'].isoformat() if r['date'] else (r['datetime'].date().isoformat() if r['datetime'] else None)
        mapped.append({
            'client_id': cid,
            'id': cid,
            'name': name,
            'date': date_str,
            'service': r.get('service'),
            'color': SERVICE_COLORS.get(r.get('service'), '#CCCCCC')
        })

    # If dedupe param is provided, return unique clients preserving order
    if request.args.get('dedupe') == '1':
        seen = set()
        recent_clients = []
        for m in mapped:
            cid = m['client_id']
            if cid in seen:
                continue
            seen.add(cid)
            recent_clients.append(m)
            if len(recent_clients) >= limit:
                break
        # Debug: also return raw records if requested
        if request.args.get('debug') == '1':
            return jsonify({'raw_records': [{
                'client_id': r['client_id'],
                'datetime': (r['date'] if isinstance(r['date'], str) else None),
                'date': r['date'],
                'service': r['service']
            } for r in mapped], 'recent_clients': recent_clients}), 200
        return jsonify(recent_clients), 200

    # Default: return mapped service records (one per record), limited
    result = mapped[:limit]
    if request.args.get('debug') == '1':
        return jsonify({'raw_records': [{
            'client_id': r['client_id'],
            'datetime': (r['date'] if isinstance(r['date'], str) else None),
            'date': r['date'],
            'service': r['service']
        } for r in mapped], 'recent_clients': result}), 200
    return jsonify(result), 200

# get all washroom records & filter by client_id and date
@app.route("/washroom_records", methods=["GET"])
def get_washroom_records():
    client_id = request.args.get("client_id")
    date_str = request.args.get("date")
    query = WashroomRecord.query

    if client_id:
        query = query.filter_by(client_id=client_id)
    if date_str:
        query = query.filter_by(date=date_str)
    
    records = query.all()
    data = WashroomSchema(many=True).dump(records)
    return jsonify(data), 200

@app.route("/washroom_records/<int:washroom_id>", methods=["GET"])
def get_washroom_record(washroom_id):
    record = WashroomRecord.query.get(washroom_id)
    if not record:
        return jsonify({"message": "Washroom record not found"}), 404
    data = WashroomSchema().dump(record)
    return jsonify(data), 200

# get all coat check records & filter by client_id and date
@app.route("/coat_check_records", methods=["GET"])
def get_coat_check_records():
    client_id = request.args.get("client_id")
    date_str = request.args.get("date")
    bin_no = request.args.get("bin_no")
    query = CoatCheckRecord.query

    if client_id:
        query = query.filter_by(client_id=client_id)
    if date_str:
        query = query.filter_by(date=date_str)
    if bin_no:
        query = query.filter_by(bin_no=bin_no)
    
    records = query.all()
    data = CoatCheckSchema(many=True).dump(records)
    return jsonify(data), 200

@app.route("/coat_check_records/<int:check_id>", methods=["GET"])
def get_coat_check_record(check_id):
    record = CoatCheckRecord.query.get(check_id)
    if not record:
        return jsonify({"message": "Coat check record not found"}), 404
    data = CoatCheckSchema().dump(record)
    return jsonify(data), 200

# get all sanctuary records & filter by client_id and date
@app.route("/sanctuary_records", methods=["GET"])
def get_sanctuary_records():
    client_id = request.args.get("client_id")
    date_str = request.args.get("date")
    query = SanctuaryRecord.query

    if client_id:
        query = query.filter_by(client_id=client_id)
    if date_str:
        query = query.filter_by(date=date_str)
    
    records = query.all()
    data = SanctuarySchema(many=True).dump(records)
    return jsonify(data), 200

@app.route("/sanctuary_records/<int:sanctuary_id>", methods=["GET"])
def get_sanctuary_record(sanctuary_id):
    record = SanctuaryRecord.query.get(sanctuary_id)
    if not record:
        return jsonify({"message": "Sanctuary record not found"}), 404
    data = SanctuarySchema().dump(record)
    return jsonify(data), 200

# get all clinic records & filter by client_id and date
@app.route("/clinic_records", methods=["GET"])   
def get_clinic_records():
    client_id = request.args.get("client_id")
    date_str = request.args.get("date")
    query = ClinicRecord.query

    if client_id:
        query = query.filter_by(client_id=client_id)
    if date_str:
        query = query.filter_by(date=date_str)
    
    records = query.all()
    data = ClinicSchema(many=True).dump(records)
    return jsonify(data), 200

@app.route("/clinic_records/<int:clinic_id>", methods=["GET"])
def get_clinic_record(clinic_id):
    record = ClinicRecord.query.get(clinic_id)
    if not record:
        return jsonify({"message": "Clinic record not found"}), 404
    data = ClinicSchema().dump(record)
    return jsonify(data), 200

@app.route("/safe_sleep_records", methods=["GET"])
def get_safe_sleep_records():
    client_id = request.args.get("client_id")
    date_str = request.args.get("date")
    query = SafeSleepRecord.query

    if client_id:
        query = query.filter_by(client_id=client_id)
    if date_str:
        query = query.filter_by(date=date_str)
    
    records = query.all()
    # Ensure `date` values are datetimes for serialization: some historical
    # records may have been stored as `date` objects. Marshmallow's
    # DateTime field expects a datetime and will raise when given a plain
    # date. Convert date -> datetime at midnight for safe serialization.
    from datetime import datetime as _dt, time as _time, date as _date
    for r in records:
        try:
            dval = getattr(r, 'date', None)
            if isinstance(dval, _date) and not isinstance(dval, _dt):
                r.date = _dt.combine(dval, _time.min)
        except Exception:
            # If conversion fails, leave as-is and let marshmallow handle/skip
            pass
    data = SafeSleepSchema(many=True).dump(records)
    return jsonify(data), 200

@app.route("/safe_sleep_records/<int:sleep_id>", methods=["GET"])
def get_safe_sleep_record(sleep_id):
    record = SafeSleepRecord.query.get(sleep_id)
    if not record:
        return jsonify({"message": "Safe sleep record not found"}), 404
    data = SafeSleepSchema().dump(record)
    return jsonify(data), 200

# get all activities
@app.route("/activity", methods=["GET"])
def get_activities():
    activity_name = request.args.get("activity_name")
    # optional query params: start_date, end_date (ISO yyyy-mm-dd)
    start = request.args.get('start_date')
    end = request.args.get('end_date')
    query = Activity.query

    if activity_name:
        query = query.filter(Activity.activity_name.ilike(f"%{activity_name}%"))

    try:
        if start:
            sd = datetime.fromisoformat(start).date()
            query = query.filter(Activity.date >= sd)
        if end:
            ed = datetime.fromisoformat(end).date()
            query = query.filter(Activity.date <= ed)
    except Exception:
        return jsonify({'message': 'Invalid date format for start_date/end_date, use YYYY-MM-DD'}), 400

    activities = query.all()
    data = ActivitySchema(many=True).dump(activities)
    try:
        print(f"[DEBUG] get_activities start={start} end={end} returned_count={len(data)}")
    except Exception:
        pass
    return jsonify(data), 200

@app.route("/activity/<int:activity_id>", methods=["GET"])
def get_activity(activity_id):
    activity = Activity.query.get(activity_id)
    if not activity:
        return jsonify({"message": "Activity not found"}), 404
    
    data = ActivitySchema().dump(activity)
    return jsonify(data), 200

# Compatibility aliases: some clients request `/activity_records`.
@app.route("/activity_records", methods=["GET"])
def get_activity_records_compat():
    return get_activities()


@app.route("/activity_records/<int:activity_id>", methods=["GET"])
def get_activity_record_compat(activity_id):
    return get_activity(activity_id)


@app.route("/activity_records/<int:activity_id>", methods=["DELETE"])
def delete_activity_record_compat(activity_id):
    return delete_activity(activity_id)

# get all client activities & filter by client_id, activity_id, and date
@app.route("/client_activity", methods=["GET"])
def get_client_activity():
    client_id = request.args.get("client_id")
    activity_id = request.args.get("activity_id")
    start = request.args.get('start_date')
    end = request.args.get('end_date')
    query = ClientActivity.query

    if client_id:
        query = query.filter_by(client_id=client_id)
    if activity_id:
        query = query.filter_by(activity_id=activity_id)

    try:
        if start:
            sd_dt = datetime.fromisoformat(start).replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(ClientActivity.date >= sd_dt)
        if end:
            ed_dt = datetime.fromisoformat(end).replace(hour=23, minute=59, second=59, microsecond=999999)
            query = query.filter(ClientActivity.date <= ed_dt)
    except Exception:
        return jsonify({'message': 'Invalid date format for start_date/end_date, use YYYY-MM-DD'}), 400

    records = query.all()
    mapped = []
    for r in records:
        client = Client.query.get(r.client_id)
        activity = Activity.query.get(r.activity_id)
        mapped.append({
            'client_activity_id': r.client_activity_id,
            'client_id': r.client_id,
            'client_name': client.full_name if client else None,
            'activity_id': r.activity_id,
            'activity_name': activity.activity_name if activity else None,
            'date': r.date.isoformat() if r.date else None,
            'score': getattr(r, 'score', None)
        })
    return jsonify(mapped), 200

@app.route("/client_activity/<int:client_activity_id>", methods=["GET"])
def get_client_activity_record(client_activity_id):
    record = ClientActivity.query.get(client_activity_id)
    if not record:
        return jsonify({"message": "Client activity record not found"}), 404
    client = Client.query.get(record.client_id)
    activity = Activity.query.get(record.activity_id)
    data = {
        'client_activity_id': record.client_activity_id,
        'client_id': record.client_id,
        'client_name': client.full_name if client else None,
        'activity_id': record.activity_id,
        'activity_name': activity.activity_name if activity else None,
        'date': record.date.isoformat() if record.date else None,
        'score': getattr(record, 'score', None)
    }
    return jsonify(data), 200


# PUT requests to update records

# update client id 
@app.route("/client/<int:client_id>", methods=["PUT"])
def update_client(client_id):
    payload = request.json
    client = Client.query.get(client_id)
    if not client:
        return jsonify({"message": "Client not found"}), 404

    try:
        data = ClientSchema().load(payload, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    for key, value in data.items():
        setattr(client, key, value)
    
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Client updated"}), 200

# update coact check records
@app.route("/coat_check_records/<int:check_id>", methods=["PUT"])
def update_coat_check_record(check_id):
    payload = request.json
    record = CoatCheckRecord.query.get(check_id)
    if not record:
        return jsonify({"message": "Coat check record not found"}), 404
    
    try:
        data = CoatCheckSchema().load(payload, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # validations for bin no and time_in/out
    if "time_out" in data and "time_in" in data:
        if data["time_out"] <= data["time_in"]:
            return jsonify({"message": "time_out must be after time_in"}), 400
        
    if "bin_no" in data and (data["bin_no"] < 1 or data["bin_no"] > 100):
        return jsonify({"message": "bin_no must be between 1 and 100"}), 400
    
    for key, value in data.items():
        setattr(record, key, value)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Coat check record updated"}), 200

# update washroom records
@app.route("/washroom_records/<int:washroom_id>", methods=["PUT"])
def update_washroom_record(washroom_id):
    payload = request.json
    record = WashroomRecord.query.get(washroom_id)
    if not record:
        return jsonify({"message": "Washroom record not found"}), 404
    
    try:
        data = WashroomSchema().load(payload, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # validations for washroom_type and time_in/out
    if "time_out" in data and "time_in" in data:
        if data["time_out"] <= data["time_in"]:
            return jsonify({"message": "time_out must be after time_in"}), 400
        
    if "washroom_type" in data:
        valid_types = ['A', 'B']
        if data["washroom_type"] not in valid_types:
            return jsonify({"message": f"washroom_type must be one of {valid_types}"}), 400
    
    for key, value in data.items():
        setattr(record, key, value)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Washroom record updated"}), 200

# update sanctuary records
@app.route("/sanctuary_records/<int:sanctuary_id>", methods=["PUT"])
def update_sanctuary_record(sanctuary_id):
    payload = request.json
    record = SanctuaryRecord.query.get(sanctuary_id)
    if not record:
        return jsonify({"message": "Sanctuary record not found"}), 404
    
    try:
        data = SanctuarySchema().load(payload, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # validations for time_in/out
    if "time_out" in data and "time_in" in data:
        if data["time_out"] <= data["time_in"]:
            return jsonify({"message": "time_out must be after time_in"}), 400
    
    for key, value in data.items():
        setattr(record, key, value)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Sanctuary record updated"}), 200

# update clinic records
@app.route("/clinic_records/<int:clinic_id>", methods=["PUT"])
def update_clinic_record(clinic_id):
    payload = request.json
    record = ClinicRecord.query.get(clinic_id)
    if not record:
        return jsonify({"message": "Clinic record not found"}), 404
    try:
        data = ClinicSchema().load(payload, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    for key, value in data.items():
        setattr(record, key, value)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    return jsonify({"message": "Clinic record updated"}), 200

# update safe sleep records
@app.route("/safe_sleep_records/<int:sleep_id>", methods=["PUT"])
def update_safe_sleep_record(sleep_id):
    payload = request.json
    record = SafeSleepRecord.query.get(sleep_id)
    if not record:
        return jsonify({"message": "Safe sleep record not found"}), 404
    try:
        data = SafeSleepSchema().load(payload, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    for key, value in data.items():
        setattr(record, key, value)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Safe sleep record updated"}), 200

# update activity
@app.route("/activity/<int:activity_id>", methods=["PUT"])
def update_activity(activity_id):
    activity = Activity.query.get(activity_id)
    if not activity:
        return jsonify({"message": "Activity not found"}), 404
    payload = request.json

    try:
        data = ActivitySchema().load(payload, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    # validate start/end time relationship when both present
    if 'start_time' in data and 'end_time' in data:
        try:
            if data['end_time'] <= data['start_time']:
                return jsonify({"message": "end_time must be after start_time"}), 400
        except Exception:
            return jsonify({"message": "Invalid start_time/end_time values"}), 400

    for key, value in data.items():
        setattr(activity, key, value)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Activity updated"}), 200

# update client activity
@app.route("/client_activity/<int:client_activity_id>", methods=["PUT"])
def update_client_activity(client_activity_id):
    record = ClientActivity.query.get(client_activity_id)
    if not record:
        return jsonify({"message": "Client activity record not found"}), 404
    payload = request.json

    try:
        data = ClientActivitySchema().load(payload, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # ensuring linked records still exist
    if "client_id" in data and not Client.query.get(data["client_id"]):
        return jsonify({"message": "Client not found"}), 404
    
    if "activity_id" in data and not Activity.query.get(data["activity_id"]):
        return jsonify({"message": "Activity not found"}), 404
    
    for key, value in data.items():
        setattr(record, key, value)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Client activity record updated"}), 200

# DELETE requests to delete records

# delete client by id
@app.route("/client/<int:client_id>", methods=["DELETE"])
def delete_client(client_id):
    client = Client.query.get(client_id)

    if not client:
        return jsonify({"message": "Client not found"}), 404
    try:
        # Remove related records from all service tables so the client is
        # fully removed across the system. Use bulk deletes for efficiency.
        WashroomRecord.query.filter_by(client_id=client_id).delete(synchronize_session=False)
        CoatCheckRecord.query.filter_by(client_id=client_id).delete(synchronize_session=False)
        SanctuaryRecord.query.filter_by(client_id=client_id).delete(synchronize_session=False)
        ClinicRecord.query.filter_by(client_id=client_id).delete(synchronize_session=False)
        SafeSleepRecord.query.filter_by(client_id=client_id).delete(synchronize_session=False)
        # ClientActivity and Activity may reference client; remove them too.
        ClientActivity.query.filter_by(client_id=client_id).delete(synchronize_session=False)

        # Finally delete the client row
        db.session.delete(client)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Client deleted"}), 200

# delete washroom record by id
@app.route("/washroom_records/<int:washroom_id>", methods=["DELETE"])
def delete_washroom_record(washroom_id):
    record = WashroomRecord.query.get(washroom_id)

    if not record:
        return jsonify({"message": "Washroom record not found"}), 404
    try:
        db.session.delete(record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Washroom record deleted"}), 200

# delete coat check record by id
@app.route("/coat_check_records/<int:check_id>", methods=["DELETE"])
def delete_coat_check_record(check_id):
    record = CoatCheckRecord.query.get(check_id)

    if not record:
        return jsonify({"message": "Coat check record not found"}), 404
    try:
        db.session.delete(record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Coat check record deleted"}), 200

# delete sanctuary record by id
@app.route("/sanctuary_records/<int:sanctuary_id>", methods=["DELETE"])
def delete_sanctuary_record(sanctuary_id):
    record = SanctuaryRecord.query.get(sanctuary_id)

    if not record:
        return jsonify({"message": "Sanctuary record not found"}), 404
    try:
        db.session.delete(record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Sanctuary record deleted"}), 200

# delete clinic record by id
@app.route("/clinic_records/<int:clinic_id>", methods=["DELETE"])
def delete_clinic_record(clinic_id):
    record = ClinicRecord.query.get(clinic_id)

    if not record:
        return jsonify({"message": "Clinic record not found"}), 404
    try:
        db.session.delete(record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Clinic record deleted"}), 200

# delete safe sleep record by id
@app.route("/safe_sleep_records/<int:sleep_id>", methods=["DELETE"])
def delete_safe_sleep_record(sleep_id):
    record = SafeSleepRecord.query.get(sleep_id)

    if not record:
        return jsonify({"message": "Safe sleep record not found"}), 404
    try:
        db.session.delete(record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Safe sleep record deleted"}), 200

# delete activity by id
@app.route("/activity/<int:activity_id>", methods=["DELETE"])
def delete_activity(activity_id):
    activity = Activity.query.get(activity_id)

    if not activity:
        return jsonify({"message": "Activity not found"}), 404
    try:
        db.session.delete(activity)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Activity deleted"}), 200

# delete client activity record by id
@app.route("/client_activity/<int:client_activity_id>", methods=["DELETE"])
def delete_client_activity(client_activity_id):
    record = ClientActivity.query.get(client_activity_id)

    if not record:
        return jsonify({"message": "Client activity record not found"}), 404
    try:
        db.session.delete(record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Client activity record deleted"}), 200

    client = Client.query.get(client_id)
    if not client:
        return jsonify({"message": "Client not found"}), 404
    
    data = ClientSchema().dump(client)
    return jsonify(data), 200

# ---------------- CLIENT STATISTICS ----------------
@app.route('/api/client-statistics', methods=['GET'])
def get_client_statistics():
    """
    Get client statistics based on time range (day, week, month, year)
    Returns total clients and breakdown by service type
    """
    try:
        from datetime import datetime, timedelta
        time_range = request.args.get('range', 'day')  # day, week, month, year
        
        # Calculate date range based on selection
        today = datetime.now().date()
        
        if time_range == 'day':
            start_date = today
            end_date = today
        elif time_range == 'week':
            start_date = today - timedelta(days=today.weekday())
            end_date = start_date + timedelta(days=6)
        elif time_range == 'month':
            start_date = today.replace(day=1)
            # Get last day of month
            if today.month == 12:
                end_date = today.replace(day=31)
            else:
                end_date = (today.replace(month=today.month + 1, day=1) - timedelta(days=1))
        elif time_range == 'year':
            start_date = today.replace(month=1, day=1)
            end_date = today.replace(month=12, day=31)
        else:
            start_date = today
            end_date = today
        
        # Get all unique clients from all service tables within date range (for total unique clients)
        client_ids = set()

        # Collect distinct client ids to compute total unique clients
        washroom_clients = db.session.query(WashroomRecord.client_id).filter(
            WashroomRecord.date >= start_date,
            WashroomRecord.date <= end_date
        ).distinct().all()
        client_ids.update([c[0] for c in washroom_clients])

        coat_check_clients = db.session.query(CoatCheckRecord.client_id).filter(
            CoatCheckRecord.date >= start_date,
            CoatCheckRecord.date <= end_date
        ).distinct().all()
        client_ids.update([c[0] for c in coat_check_clients])

        sanctuary_clients = db.session.query(SanctuaryRecord.client_id).filter(
            SanctuaryRecord.date >= start_date,
            SanctuaryRecord.date <= end_date
        ).distinct().all()
        client_ids.update([c[0] for c in sanctuary_clients])

        clinic_clients = db.session.query(ClinicRecord.client_id).filter(
            ClinicRecord.date >= start_date,
            ClinicRecord.date <= end_date
        ).distinct().all()
        client_ids.update([c[0] for c in clinic_clients])

        safe_sleep_clients = db.session.query(SafeSleepRecord.client_id).filter(
            SafeSleepRecord.date >= start_date,
            SafeSleepRecord.date <= end_date
        ).distinct().all()
        client_ids.update([c[0] for c in safe_sleep_clients])

        # total unique clients across service tables
        total_unique_clients = len(client_ids)

        # Get breakdown by service as counts of entries (not distinct clients)
        coat_check_count = db.session.query(func.count(CoatCheckRecord.check_id)).filter(
            CoatCheckRecord.date >= start_date,
            CoatCheckRecord.date <= end_date
        ).scalar() or 0

        washroom_count = db.session.query(func.count(WashroomRecord.washroom_id)).filter(
            WashroomRecord.date >= start_date,
            WashroomRecord.date <= end_date
        ).scalar() or 0

        sanctuary_count = db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(
            SanctuaryRecord.date >= start_date,
            SanctuaryRecord.date <= end_date
        ).scalar() or 0

        clinic_count = db.session.query(func.count(ClinicRecord.clinic_id)).filter(
            ClinicRecord.date >= start_date,
            ClinicRecord.date <= end_date
        ).scalar() or 0

        # use the datetime `date` field; compare only the date portion for range filters
        safe_sleep_count = db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(
            func.date(SafeSleepRecord.date) >= start_date,
            func.date(SafeSleepRecord.date) <= end_date
        ).scalar() or 0

        service_breakdown = {
            'Coat Check': int(coat_check_count),
            'Washroom': int(washroom_count),
            'Sanctuary': int(sanctuary_count),
            'Clinic': int(clinic_count),
            'Safe Sleep': int(safe_sleep_count)
        }
        # total_visitors represents total service usages (sum of all service counts)
        total_visitors = int(coat_check_count + washroom_count + sanctuary_count + clinic_count + safe_sleep_count)
        
        # Get hourly/daily/monthly data for the chart
        chart_data = []
        chart_unique = []
        
        if time_range == 'day':
            # include date-only services (Clinic, SafeSleep) into the current hour bucket
            clinic_today = db.session.query(func.count(ClinicRecord.clinic_id)).filter(func.date(ClinicRecord.date) == today).scalar() or 0
            safe_sleep_today = db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(SafeSleepRecord.date == today).scalar() or 0

            # determine which hour bucket to put date-only records into (clamp to displayed hours 9-18)
            current_hour = datetime.now().hour
            bucket_hour = min(max(current_hour, 9), 18)

            for hour in range(9, 19):
                hour_start = datetime.combine(today, datetime.min.time().replace(hour=hour))
                hour_end = hour_start + timedelta(hours=1)
                hour_total = 0
                hour_unique_ids = set()

                # count records with explicit time_in in this hour (visitors)
                hour_total += db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.time_in >= hour_start, WashroomRecord.time_in < hour_end).scalar() or 0
                hour_total += db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.time_in >= hour_start, CoatCheckRecord.time_in < hour_end).scalar() or 0
                hour_total += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.time_in >= hour_start, SanctuaryRecord.time_in < hour_end).scalar() or 0

                # collect distinct client ids for this hour (unique clients)
                try:
                    rows = db.session.query(WashroomRecord.client_id).filter(WashroomRecord.time_in >= hour_start, WashroomRecord.time_in < hour_end).distinct().all()
                    hour_unique_ids.update([r[0] for r in rows if r and r[0] is not None])
                except Exception:
                    pass
                try:
                    rows = db.session.query(CoatCheckRecord.client_id).filter(CoatCheckRecord.time_in >= hour_start, CoatCheckRecord.time_in < hour_end).distinct().all()
                    hour_unique_ids.update([r[0] for r in rows if r and r[0] is not None])
                except Exception:
                    pass
                try:
                    rows = db.session.query(SanctuaryRecord.client_id).filter(SanctuaryRecord.time_in >= hour_start, SanctuaryRecord.time_in < hour_end).distinct().all()
                    hour_unique_ids.update([r[0] for r in rows if r and r[0] is not None])
                except Exception:
                    pass

                # add date-only counts into the current hour bucket so they appear on the day chart
                if hour == bucket_hour:
                    hour_total += (clinic_today or 0) + (safe_sleep_today or 0)

                    # also include any washroom/sanctuary/coatcheck rows where time_in is null but date == today
                    hour_total += db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.time_in == None, WashroomRecord.date == today).scalar() or 0
                    hour_total += db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.time_in == None, CoatCheckRecord.date == today).scalar() or 0
                    hour_total += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.time_in == None, SanctuaryRecord.date == today).scalar() or 0

                    # include distinct client ids from date-only services for today into unique set
                    try:
                        rows = db.session.query(ClinicRecord.client_id).filter(func.date(ClinicRecord.date) == today).distinct().all()
                        hour_unique_ids.update([r[0] for r in rows if r and r[0] is not None])
                    except Exception:
                        pass
                    try:
                        rows = db.session.query(SafeSleepRecord.client_id).filter(SafeSleepRecord.date == today).distinct().all()
                        hour_unique_ids.update([r[0] for r in rows if r and r[0] is not None])
                    except Exception:
                        pass
                    # do not include ClientActivity (events) in stakeholder-facing unique counts

                # Format hour label (9am, 10am, 11am, 12pm, 1pm, 2pm, etc.)
                if hour < 12:
                    label = f"{hour}am"
                elif hour == 12:
                    label = "12pm"
                else:
                    label = f"{hour-12}pm"

                chart_data.append({
                    'label': label,
                    'value': int(hour_total)
                })
                chart_unique.append({'label': label, 'value': int(len(hour_unique_ids))})
        
        elif time_range == 'week':
            # Group by day of week
            days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            for i in range(7):
                day_date = start_date + timedelta(days=i)
                day_total = 0
                day_unique_ids = set()
                day_total += db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(ClinicRecord.clinic_id)).filter(ClinicRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(SafeSleepRecord.date == day_date).scalar() or 0
                # (exclude activity attendance records from stakeholder-facing totals)

                try:
                    rows = db.session.query(WashroomRecord.client_id).filter(WashroomRecord.date == day_date).distinct().all()
                    day_unique_ids.update([r[0] for r in rows if r and r[0] is not None])
                except Exception:
                    pass
                try:
                    rows = db.session.query(CoatCheckRecord.client_id).filter(CoatCheckRecord.date == day_date).distinct().all()
                    day_unique_ids.update([r[0] for r in rows if r and r[0] is not None])
                except Exception:
                    pass
                try:
                    rows = db.session.query(SanctuaryRecord.client_id).filter(SanctuaryRecord.date == day_date).distinct().all()
                    day_unique_ids.update([r[0] for r in rows if r and r[0] is not None])
                except Exception:
                    pass
                try:
                    rows = db.session.query(ClinicRecord.client_id).filter(ClinicRecord.date == day_date).distinct().all()
                    day_unique_ids.update([r[0] for r in rows if r and r[0] is not None])
                except Exception:
                    pass
                try:
                    rows = db.session.query(SafeSleepRecord.client_id).filter(SafeSleepRecord.date == day_date).distinct().all()
                    day_unique_ids.update([r[0] for r in rows if r and r[0] is not None])
                except Exception:
                    pass
                # do not include ClientActivity (events) in stakeholder-facing unique counts

                chart_data.append({
                    'label': days[i],
                    'value': int(day_total)
                })
                chart_unique.append({'label': days[i], 'value': int(len(day_unique_ids))})
        
        elif time_range == 'month':
            # For month view return every day so the x-axis shows all days.
            # Count all service entries per day (not unique clients) so the line reflects visitor counts.
            days_in_month = (end_date - start_date).days + 1
            for i in range(0, days_in_month):
                sample_date = start_date + timedelta(days=i)
                client_ids_cum = set()
                for q in [WashroomRecord, CoatCheckRecord, SanctuaryRecord, ClinicRecord, SafeSleepRecord]:
                    try:
                        rows = db.session.query(q.client_id).filter(q.date >= start_date, q.date <= sample_date).distinct().all()
                        client_ids_cum.update([r[0] for r in rows if r and r[0] is not None])
                    except Exception:
                        pass

                # visitors per day (non-cumulative)
                day_visitors = 0
                day_visitors += db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.date == sample_date).scalar() or 0
                day_visitors += db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.date == sample_date).scalar() or 0
                day_visitors += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.date == sample_date).scalar() or 0
                day_visitors += db.session.query(func.count(ClinicRecord.clinic_id)).filter(ClinicRecord.date == sample_date).scalar() or 0
                day_visitors += db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(SafeSleepRecord.date == sample_date).scalar() or 0
                # exclude ClientActivity from visitor counts shown to stakeholders

                chart_data.append({
                    'label': sample_date.strftime('%d'),
                    'value': int(day_visitors)
                })
                chart_unique.append({'label': sample_date.strftime('%d'), 'value': int(len(client_ids_cum))})
        
        elif time_range == 'year':
            # Group by month
            months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            for month in range(1, 13):
                month_start = today.replace(month=month, day=1)
                if month == 12:
                    month_end = today.replace(month=12, day=31)
                else:
                    month_end = (today.replace(month=month + 1, day=1) - timedelta(days=1))

                month_total = 0
                month_total += db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.date >= month_start, WashroomRecord.date <= month_end).scalar() or 0
                month_total += db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.date >= month_start, CoatCheckRecord.date <= month_end).scalar() or 0
                month_total += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.date >= month_start, SanctuaryRecord.date <= month_end).scalar() or 0
                month_total += db.session.query(func.count(ClinicRecord.clinic_id)).filter(ClinicRecord.date >= month_start, ClinicRecord.date <= month_end).scalar() or 0
                month_total += db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(SafeSleepRecord.date >= month_start, SafeSleepRecord.date <= month_end).scalar() or 0
                # exclude ClientActivity from stakeholder-facing monthly totals

                month_unique_ids = set()
                try:
                    rows = db.session.query(WashroomRecord.client_id).filter(WashroomRecord.date >= month_start, WashroomRecord.date <= month_end).distinct().all()
                    month_unique_ids.update([r[0] for r in rows if r and r[0] is not None])
                except Exception:
                    pass
                try:
                    rows = db.session.query(CoatCheckRecord.client_id).filter(CoatCheckRecord.date >= month_start, CoatCheckRecord.date <= month_end).distinct().all()
                    month_unique_ids.update([r[0] for r in rows if r and r[0] is not None])
                except Exception:
                    pass
                try:
                    rows = db.session.query(SanctuaryRecord.client_id).filter(SanctuaryRecord.date >= month_start, SanctuaryRecord.date <= month_end).distinct().all()
                    month_unique_ids.update([r[0] for r in rows if r and r[0] is not None])
                except Exception:
                    pass
                try:
                    rows = db.session.query(ClinicRecord.client_id).filter(ClinicRecord.date >= month_start, ClinicRecord.date <= month_end).distinct().all()
                    month_unique_ids.update([r[0] for r in rows if r and r[0] is not None])
                except Exception:
                    pass
                try:
                    rows = db.session.query(SafeSleepRecord.client_id).filter(SafeSleepRecord.date >= month_start, SafeSleepRecord.date <= month_end).distinct().all()
                    month_unique_ids.update([r[0] for r in rows if r and r[0] is not None])
                except Exception:
                    pass
                # do not include ClientActivity in stakeholder-facing unique counts for months

                chart_data.append({
                    'label': months[month - 1],
                    'value': int(month_total)
                })
                chart_unique.append({'label': months[month - 1], 'value': int(len(month_unique_ids))})
        
        return jsonify({
            'success': True,
            # total_clients = unique client count, total_visitors = total service usages
            'total_clients': int(total_unique_clients),
            'total_visitors': int(total_visitors),
            'service_breakdown': service_breakdown,
            'chart_data': chart_data,
            'chart_unique': chart_unique
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': 'Error fetching statistics',
            'error': str(e)
        }), 500
    
# ---------------- COAT CHECK STATISTICS ----------------
@app.route('/api/coat-check-statistics', methods=['GET'])
def get_coat_check_statistics():
    """
    Get client statistics based on time range (day, week, month, year)
    Returns total clients and breakdown by service type
    """
    try:
        from datetime import datetime, timedelta
        time_range = request.args.get('range', 'day')  # day, week, month, year
        
        # Calculate date range based on selection
        today = datetime.now().date()
        
        if time_range == 'day':
            start_date = today
            end_date = today
        elif time_range == 'week':
            start_date = today - timedelta(days=today.weekday())
            end_date = start_date + timedelta(days=6)
        elif time_range == 'month':
            start_date = today.replace(day=1)
            # Get last day of month
            if today.month == 12:
                end_date = today.replace(day=31)
            else:
                end_date = (today.replace(month=today.month + 1, day=1) - timedelta(days=1))
        elif time_range == 'year':
            start_date = today.replace(month=1, day=1)
            end_date = today.replace(month=12, day=31)
        else:
            start_date = today
            end_date = today
        
        # Get all unique clients from all service tables within date range (for total unique clients)
        client_ids = set()

        coat_check_clients = db.session.query(CoatCheckRecord.client_id).filter(
            CoatCheckRecord.date >= start_date,
            CoatCheckRecord.date <= end_date
        ).distinct().all()
        client_ids.update([c[0] for c in coat_check_clients])

         # Get breakdown by service as counts of entries (not distinct clients)
        coat_check_count = db.session.query(func.count(CoatCheckRecord.check_id)).filter(
            CoatCheckRecord.date >= start_date,
            CoatCheckRecord.date <= end_date
        ).scalar() or 0

        service_breakdown = {
            'Coat Check': int(coat_check_count)
        }
        # total_clients should represent total service usages (sum of coat check counts)
        total_clients = int(coat_check_count)

        # Build chart data for coat check similar to other endpoints
        chart_data = []
        if time_range == 'day':
            for hour in range(9, 19):  # 9am to 6pm
                hour_start = datetime.combine(today, datetime.min.time()).replace(hour=hour)
                hour_end = hour_start + timedelta(hours=1)

                hour_total = db.session.query(func.count(CoatCheckRecord.check_id)).filter(
                    CoatCheckRecord.time_in >= hour_start,
                    CoatCheckRecord.time_in < hour_end
                ).scalar() or 0

                if hour < 12:
                    label = f"{hour}am"
                elif hour == 12:
                    label = "12pm"
                else:
                    label = f"{hour-12}pm"

                chart_data.append({ 'label': label, 'value': int(hour_total) })
        elif time_range == 'week':
            days_labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            for i in range(7):
                day_date = start_date + timedelta(days=i)
                day_total = db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.date == day_date).scalar() or 0
                chart_data.append({ 'label': days_labels[i], 'value': int(day_total) })
        elif time_range == 'month':
            days_in_month = (end_date - start_date).days + 1
            for i in range(0, days_in_month):
                day_date = start_date + timedelta(days=i)
                day_total = db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.date == day_date).scalar() or 0
                chart_data.append({ 'label': day_date.strftime('%d'), 'value': int(day_total) })
        elif time_range == 'year':
            months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            for month in range(1, 13):
                month_start = today.replace(month=month, day=1)
                if month == 12:
                    month_end = today.replace(month=12, day=31)
                else:
                    month_end = (today.replace(month=month + 1, day=1) - timedelta(days=1))
                month_total = db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.date >= month_start, CoatCheckRecord.date <= month_end).scalar() or 0
                chart_data.append({ 'label': months[month - 1], 'value': int(month_total) })

        return jsonify({
            'success': True,
            'total_clients': total_clients,
            'service_breakdown': service_breakdown,
            'chart_data': chart_data
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': 'Error fetching statistics',
            'error': str(e)
        }), 500

# ---------------- DEPARTMENT HEATMAP ----------------
@app.route('/api/department-heatmap', methods=['GET'])
def get_department_heatmap():
    """
    Returns counts per weekday (Monday-Friday) and per hour (9..18) for a given department.
    Query params:
      - dept: department key (coatcheck, washroom, sanctuary, clinic, safe-sleep)
      - range: day|week|month|year (same semantics as other stats)
    Response shape: { success: True, data: { 'Monday': {'9': 0, ...}, ... } }
    """
    try:
        from datetime import datetime, timedelta
        dept = (request.args.get('dept') or '').lower()
        time_range = request.args.get('range', 'day')

        # Determine date range
        today = datetime.now().date()
        if time_range == 'day':
            start_date = today
            end_date = today
        elif time_range == 'week':
            start_date = today - timedelta(days=today.weekday())
            end_date = start_date + timedelta(days=6)
        elif time_range == 'month':
            start_date = today.replace(day=1)
            if today.month == 12:
                end_date = today.replace(day=31)
            else:
                end_date = (today.replace(month=today.month + 1, day=1) - timedelta(days=1))
        elif time_range == 'year':
            start_date = today.replace(month=1, day=1)
            end_date = today.replace(month=12, day=31)
        else:
            start_date = today
            end_date = today

        # mapping of department keys to model and attribute to use for timestamp
        mapping = {
            'coatcheck': (CoatCheckRecord, 'time_in'),
            'coat-check': (CoatCheckRecord, 'time_in'),
            'washroom': (WashroomRecord, 'time_in'),
            'sanctuary': (SanctuaryRecord, 'time_in'),
            'clinic': (ClinicRecord, 'date'),
            'safe-sleep': (SafeSleepRecord, 'date'),
            'safesleep': (SafeSleepRecord, 'date')
        }

        if dept not in mapping:
            return jsonify({'success': False, 'message': 'Unknown department'}), 400

        model, attr = mapping[dept]

        # Prepare empty structure for Monday-Friday, hours 9..18
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        hours = list(range(9, 19))
        out = {d: {str(h): 0 for h in hours} for d in days}

        # Query records in date range. For datetime attrs use full-day bounds.
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())

        column = getattr(model, attr)
        # If attribute is a Date (no time), query by date equality
        # We'll attempt to fetch values and then map to hours where possible
        results = None
        try:
            results = db.session.query(column).filter(column >= start_dt, column <= end_dt).all()
        except Exception:
            # fallback: if column is a Date type (no time), query by date range
            results = db.session.query(column).filter(column >= start_date, column <= end_date).all()

        for r in results:
            if not r:
                continue
            val = r[0]
            if val is None:
                continue
            # val may be date or datetime
            if isinstance(val, datetime):
                wk = val.weekday()  # Monday=0
                hr = val.hour
            else:
                # date only: treat as occurring at 9am (default bucket)
                wk = val.weekday()
                hr = 9

            if wk >= 0 and wk <= 4 and hr >= 9 and hr <= 18:
                out[days[wk]][str(hr)] += 1

        return jsonify({'success': True, 'data': out}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': 'Error computing heatmap', 'error': str(e)}), 500

# ---------------- WASHROOM STATISTICS ----------------
@app.route('/api/washroom-statistics', methods=['GET'])
def get_washroom_statistics():
    """
    Get washroom statistics based on time range (day, week, month, year)
    Returns total washroom records
    """
    try:
        from datetime import datetime, timedelta
        time_range = request.args.get('range', 'day')  # day, week, month, year

        # Calculate date range based on selection
        today = datetime.now().date()

        if time_range == 'day':
            start_date = today
            end_date = today
        elif time_range == 'week':
            start_date = today - timedelta(days=today.weekday())
            end_date = start_date + timedelta(days=6)
        elif time_range == 'month':
            start_date = today.replace(day=1)
            # Get last day of month
            if today.month == 12:
                end_date = today.replace(day=31)
            else:
                end_date = (today.replace(month=today.month + 1, day=1) - timedelta(days=1))
        elif time_range == 'year':
            start_date = today.replace(month=1, day=1)
            end_date = today.replace(month=12, day=31)
        else:
            start_date = today
            end_date = today

        # Get unique clients who used the washroom in the date range
        client_ids = set()

        washroom_clients = db.session.query(WashroomRecord.client_id).filter(
            WashroomRecord.date >= start_date,
            WashroomRecord.date <= end_date
        ).distinct().all()
        client_ids.update([c[0] for c in washroom_clients])

        # Get breakdown by service as counts of entries (not distinct clients)
        washroom_count = db.session.query(func.count(WashroomRecord.washroom_id)).filter(
            WashroomRecord.date >= start_date,
            WashroomRecord.date <= end_date
        ).scalar() or 0

        service_breakdown = {
            'Washroom': int(washroom_count)
        }

        # total_clients here represents total washroom usages
        total_clients = int(washroom_count)

        # Get hourly/daily/monthly data for the chart
        chart_data = []

        if time_range == 'day':
            # Group by hour (9am to 6pm) and count washroom entries only
            for hour in range(9, 19):  # 9am to 6pm
                hour_start = datetime.combine(today, datetime.min.time().replace(hour=hour))
                hour_end = hour_start + timedelta(hours=1)

                hour_total = db.session.query(func.count(WashroomRecord.washroom_id)).filter(
                    WashroomRecord.time_in >= hour_start,
                    WashroomRecord.time_in < hour_end
                ).scalar() or 0

                # Format hour label (9am, 10am, 11am, 12pm, 1pm, 2pm, etc.)
                if hour < 12:
                    label = f"{hour}am"
                elif hour == 12:
                    label = "12pm"
                else:
                    label = f"{hour-12}pm"

                chart_data.append({
                    'label': label,
                    'value': int(hour_total)
                })

        elif time_range == 'week':
            # Group by day of week
            days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            for i in range(7):
                day_date = start_date + timedelta(days=i)
                day_total = db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.date == day_date).scalar() or 0

                chart_data.append({
                    'label': days[i],
                    'value': int(day_total)
                })

        elif time_range == 'month':
            # For month view return every day so the x-axis shows all days.
            # Count all service entries per day (not unique clients) so the line reflects visitor counts.
            days_in_month = (end_date - start_date).days + 1
            for i in range(0, days_in_month):
                day_date = start_date + timedelta(days=i)
                day_total = db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.date == day_date).scalar() or 0

                chart_data.append({
                    'label': day_date.strftime('%d'),
                    'value': int(day_total)
                })

        elif time_range == 'year':
            # Group by month
            months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            for month in range(1, 13):
                month_start = today.replace(month=month, day=1)
                if month == 12:
                    month_end = today.replace(month=12, day=31)
                else:
                    month_end = (today.replace(month=month + 1, day=1) - timedelta(days=1))

                month_total = db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.date >= month_start, WashroomRecord.date <= month_end).scalar() or 0

                chart_data.append({
                    'label': months[month - 1],
                    'value': int(month_total)
                })

        return jsonify({
            'success': True,
            'total_clients': total_clients,
            'service_breakdown': service_breakdown,
            'chart_data': chart_data
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': 'Error fetching statistics',
            'error': str(e)
        }), 500

# ---------------- SANCTUARY STATISTICS ----------------
@app.route('/api/sanctuary-statistics', methods=['GET'])
def get_sanctuary_statistics():
    """
    Get sanctuary statistics based on time range (day, week, month, year)
    Returns total sanctuary records
    """
    try:
        from datetime import datetime, timedelta
        time_range = request.args.get('range', 'day')  # day, week, month, year

        # Calculate date range based on selection
        today = datetime.now().date()

        if time_range == 'day':
            start_date = today
            end_date = today
        elif time_range == 'week':
            start_date = today - timedelta(days=today.weekday())
            end_date = start_date + timedelta(days=6)
        elif time_range == 'month':
            start_date = today.replace(day=1)
            # Get last day of month
            if today.month == 12:
                end_date = today.replace(day=31)
            else:
                end_date = (today.replace(month=today.month + 1, day=1) - timedelta(days=1))
        elif time_range == 'year':
            start_date = today.replace(month=1, day=1)
            end_date = today.replace(month=12, day=31)
        else:
            start_date = today
            end_date = today

        # Get unique clients who used the washroom in the date range
        client_ids = set()

        sanctuary_clients = db.session.query(SanctuaryRecord.sanctuary_id).filter(
            SanctuaryRecord.date >= start_date,
            SanctuaryRecord.date <= end_date
        ).distinct().all()
        client_ids.update([c[0] for c in sanctuary_clients])

        # Get breakdown by service as counts of entries (not distinct clients)
        sanctuary_count = db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(
            SanctuaryRecord.date >= start_date,
            SanctuaryRecord.date <= end_date
        ).scalar() or 0

        service_breakdown = {
            'Sanctuary': int(sanctuary_count)
        }

        # total_clients here represents total washroom usages
        total_clients = int(sanctuary_count)

        # Get hourly/daily/monthly data for the chart
        chart_data = []

        if time_range == 'day':
            # Group by hour (9am to 6pm) and count washroom entries only
            for hour in range(9, 19):  # 9am to 6pm
                hour_start = datetime.combine(today, datetime.min.time().replace(hour=hour))
                hour_end = hour_start + timedelta(hours=1)

                hour_total = db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(
                    SanctuaryRecord.time_in >= hour_start,
                    SanctuaryRecord.time_in < hour_end
                ).scalar() or 0

                # Format hour label (9am, 10am, 11am, 12pm, 1pm, 2pm, etc.)
                if hour < 12:
                    label = f"{hour}am"
                elif hour == 12:
                    label = "12pm"
                else:
                    label = f"{hour-12}pm"

                chart_data.append({
                    'label': label,
                    'value': int(hour_total)
                })

        elif time_range == 'week':
            # Group by day of week
            days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            for i in range(7):
                day_date = start_date + timedelta(days=i)
                day_total = db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.date == day_date).scalar() or 0

                chart_data.append({
                    'label': days[i],
                    'value': int(day_total)
                })

        elif time_range == 'month':
            # For month view return every day so the x-axis shows all days.
            # Count all service entries per day (not unique clients) so the line reflects visitor counts.
            days_in_month = (end_date - start_date).days + 1
            for i in range(0, days_in_month):
                day_date = start_date + timedelta(days=i)
                day_total = db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.date == day_date).scalar() or 0

                chart_data.append({
                    'label': day_date.strftime('%d'),
                    'value': int(day_total)
                })

        elif time_range == 'year':
            # Group by month
            months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            for month in range(1, 13):
                month_start = today.replace(month=month, day=1)
                if month == 12:
                    month_end = today.replace(month=12, day=31)
                else:
                    month_end = (today.replace(month=month + 1, day=1) - timedelta(days=1))

                month_total = db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.date >= month_start, SanctuaryRecord.date <= month_end).scalar() or 0

                chart_data.append({
                    'label': months[month - 1],
                    'value': int(month_total)
                })

        return jsonify({
            'success': True,
            'total_clients': total_clients,
            'service_breakdown': service_breakdown,
            'chart_data': chart_data
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': 'Error fetching statistics',
            'error': str(e)
        }), 500


# ---------------- CLINIC STATISTICS ----------------
@app.route('/api/clinic-statistics', methods=['GET'])
def get_clinic_statistics():
    """
    Get clinic statistics based on time range (day, week, month, year)
    Returns total clinic records and chart data
    """
    try:
        from datetime import datetime, timedelta
        time_range = request.args.get('range', 'day')  # day, week, month, year

        # Calculate date range based on selection
        today = datetime.now().date()

        if time_range == 'day':
            start_date = today
            end_date = today
        elif time_range == 'week':
            start_date = today - timedelta(days=today.weekday())
            end_date = start_date + timedelta(days=6)
        elif time_range == 'month':
            start_date = today.replace(day=1)
            # Get last day of month
            if today.month == 12:
                end_date = today.replace(day=31)
            else:
                end_date = (today.replace(month=today.month + 1, day=1) - timedelta(days=1))
        elif time_range == 'year':
            start_date = today.replace(month=1, day=1)
            end_date = today.replace(month=12, day=31)
        else:
            start_date = today
            end_date = today

        # Count clinic records in range
        clinic_count = db.session.query(func.count(ClinicRecord.clinic_id)).filter(
            ClinicRecord.date >= start_date,
            ClinicRecord.date <= end_date
        ).scalar() or 0

        total_clients = int(clinic_count)

        # Build chart data
        chart_data = []
        if time_range == 'day':
            # No time component on ClinicRecord.date; return single value for today
            chart_data.append({'label': 'Today', 'value': int(clinic_count)})

        elif time_range == 'week':
            days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            for i in range(7):
                day_date = start_date + timedelta(days=i)
                day_total = db.session.query(func.count(ClinicRecord.clinic_id)).filter(ClinicRecord.date == day_date).scalar() or 0
                chart_data.append({'label': days[i], 'value': int(day_total)})

        elif time_range == 'month':
            days_in_month = (end_date - start_date).days + 1
            for i in range(0, days_in_month):
                day_date = start_date + timedelta(days=i)
                day_total = db.session.query(func.count(ClinicRecord.clinic_id)).filter(ClinicRecord.date == day_date).scalar() or 0
                chart_data.append({'label': day_date.strftime('%d'), 'value': int(day_total)})

        elif time_range == 'year':
            months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            for month in range(1, 13):
                month_start = today.replace(month=month, day=1)
                if month == 12:
                    month_end = today.replace(month=12, day=31)
                else:
                    month_end = (today.replace(month=month + 1, day=1) - timedelta(days=1))

                month_total = db.session.query(func.count(ClinicRecord.clinic_id)).filter(ClinicRecord.date >= month_start, ClinicRecord.date <= month_end).scalar() or 0
                chart_data.append({'label': months[month - 1], 'value': int(month_total)})

        return jsonify({'success': True, 'total_clients': total_clients, 'chart_data': chart_data}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': 'Error fetching statistics', 'error': str(e)}), 500

# ---------------- SAFE SLEEP STATISTICS ----------------
@app.route('/api/safe-sleep-statistics', methods=['GET'])
def get_safe_sleep_statistics():
    """
    Get safe sleep statistics based on time range (day, week, month, year)
    Returns total safe sleep records
    """
    try:
        from datetime import datetime, timedelta
        time_range = request.args.get('range', 'day')  # day, week, month, year

        # Calculate date range based on selection
        today = datetime.now().date()

        if time_range == 'day':
            start_date = today
            end_date = today
        elif time_range == 'week':
            start_date = today - timedelta(days=today.weekday())
            end_date = start_date + timedelta(days=6)
        elif time_range == 'month':
            start_date = today.replace(day=1)
            # Get last day of month
            if today.month == 12:
                end_date = today.replace(day=31)
            else:
                end_date = (today.replace(month=today.month + 1, day=1) - timedelta(days=1))
        elif time_range == 'year':
            start_date = today.replace(month=1, day=1)
            end_date = today.replace(month=12, day=31)
        else:
            start_date = today
            end_date = today

        # Convert date range endpoints to datetimes so comparisons against the
        # `SafeSleepRecord.date` (which is a DateTime column) include the full
        # span of each day. This prevents incorrect counts when comparing
        # datetimes to date objects (which would otherwise be treated as
        # midnight-only timestamps).
        from datetime import datetime as _dt
        start_dt = _dt.combine(start_date, _dt.min.time())
        end_dt = _dt.combine(end_date, _dt.max.time())

        # Get breakdown by service as counts of entries (not distinct clients)
        safe_sleep_count = db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(
            SafeSleepRecord.date >= start_dt,
            SafeSleepRecord.date <= end_dt
        ).scalar() or 0

        service_breakdown = {
            'Safe Sleep': int(safe_sleep_count)
        }

        # total_clients here represents total washroom usages
        total_clients = int(safe_sleep_count)

        # Get hourly/daily/monthly data for the chart
        chart_data = []

        if time_range == 'day':
            # Group by each hour of the day (0-23) using the datetime `date` field
            for hour in range(0, 24):
                hour_start = datetime.combine(today, datetime.min.time()).replace(hour=hour)
                hour_end = hour_start + timedelta(hours=1)
                hour_total = db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(
                    SafeSleepRecord.date >= hour_start,
                    SafeSleepRecord.date < hour_end
                ).scalar() or 0

                # Format label: 12am, 1am, ..., 12pm, 1pm, ...
                if hour == 0:
                    label = '12am'
                elif hour < 12:
                    label = f"{hour}am"
                elif hour == 12:
                    label = '12pm'
                else:
                    label = f"{hour-12}pm"

                chart_data.append({ 'label': label, 'value': int(hour_total) })

        elif time_range == 'week':
            # Group by day of week
            days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            for i in range(7):
                day_date = start_date + timedelta(days=i)
                day_start = datetime.combine(day_date, datetime.min.time())
                day_end = datetime.combine(day_date, datetime.max.time())
                day_total = db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(
                    SafeSleepRecord.date >= day_start,
                    SafeSleepRecord.date <= day_end
                ).scalar() or 0

                chart_data.append({
                    'label': days[i],
                    'value': int(day_total)
                })

        elif time_range == 'month':
            # For month view return every day so the x-axis shows all days.
            # Count all service entries per day (not unique clients) so the line reflects visitor counts.
            days_in_month = (end_date - start_date).days + 1
            for i in range(0, days_in_month):
                day_date = start_date + timedelta(days=i)
                day_start = datetime.combine(day_date, datetime.min.time())
                day_end = datetime.combine(day_date, datetime.max.time())
                day_total = db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(
                    SafeSleepRecord.date >= day_start,
                    SafeSleepRecord.date <= day_end
                ).scalar() or 0

                chart_data.append({
                    'label': day_date.strftime('%d'),
                    'value': int(day_total)
                })

        elif time_range == 'year':
            # Group by month
            months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            for month in range(1, 13):
                month_start = today.replace(month=month, day=1)
                if month == 12:
                    month_end = today.replace(month=12, day=31)
                else:
                    month_end = (today.replace(month=month + 1, day=1) - timedelta(days=1))

                month_start_dt = datetime.combine(month_start, datetime.min.time())
                month_end_dt = datetime.combine(month_end, datetime.max.time())
                month_total = db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(
                    SafeSleepRecord.date >= month_start_dt,
                    SafeSleepRecord.date <= month_end_dt
                ).scalar() or 0

                chart_data.append({
                    'label': months[month - 1],
                    'value': int(month_total)
                })

        return jsonify({
            'success': True,
            'total_clients': total_clients,
            'service_breakdown': service_breakdown,
            'chart_data': chart_data
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': 'Error fetching statistics',
            'error': str(e)
        }), 500

# ---------------- AUTHENTICATION ----------------
@app.route('/api/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "message": "No data provided"
            }), 400
        
        username = data.get('username')
        password = data.get('password')
        
        # Hardcoded credentials
        if username == 'adminuser' and password == 'Admin2025!':
            return jsonify({
                "success": True,
                "message": "Login successful"
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": "Invalid username or password"
            }), 401
    except Exception as e:
        return jsonify({
            "success": False,
            "message": "An error occurred during login",
            "error": str(e)
        }), 500

# run the app if this file is executed directly
if __name__ == '__main__':
    app.run(debug=True)

class Client(db.Model):
    __tablename__ = "client"
    client_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    full_name = db.Column(db.String(255), nullable=False)
    # dob column removed from DB schema
    gender = db.Column(db.String(2), nullable=True)

class WashroomRecord(db.Model):
    __tablename__ = "washroom_records"
    washroom_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    client_id = db.Column(db.Integer, db.ForeignKey('client.client_id'), nullable=False)
    washroom_type = db.Column(db.String(1), nullable=False) 
    time_in = db.Column(db.DateTime, nullable=False)
    time_out = db.Column(db.DateTime, nullable=True)
    date = db.Column(db.Date, nullable=False)

class CoatCheckRecord(db.Model):
    __tablename__ = "coat_check_records"
    check_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    client_id = db.Column(db.Integer, db.ForeignKey('client.client_id'), nullable=False)
    bin_no = db.Column(db.Integer, nullable=False)
    time_in = db.Column(db.DateTime, nullable=False)
    time_out = db.Column(db.DateTime, nullable=True)
    date = db.Column(db.Date, nullable=False)

class SanctuaryRecord(db.Model):
    __tablename__ = "sanctuary_records"
    sanctuary_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    client_id = db.Column(db.Integer, db.ForeignKey('client.client_id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    time_in = db.Column(db.DateTime, nullable=False)
    time_out = db.Column(db.DateTime, nullable=True)
    purpose_of_visit = db.Column(db.Text, nullable=True)
    if_serviced = db.Column(db.Boolean, nullable=False, default=False)

class ClinicRecord(db.Model):
    __tablename__ = "clinic_records"
    clinic_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    client_id = db.Column(db.Integer, db.ForeignKey('client.client_id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    purpose_of_visit = db.Column(db.Text, nullable=True)

class SafeSleepRecord(db.Model):
    __tablename__ = "safe_sleep_records"
    sleep_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    client_id = db.Column(db.Integer, db.ForeignKey('client.client_id'), nullable=False)
    bed_no = db.Column(db.Integer, nullable=True)
    is_occupied = db.Column(db.Boolean, nullable=False, default=False)
    # store full datetime so we can record the time the bed was occupied
    date = db.Column(db.DateTime, nullable=False)

class Activity(db.Model):
    __tablename__ = "activity_records"
    activity_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    activity_name = db.Column(db.String(255), nullable=False)
    date = db.Column(db.Date, nullable=False)

class ClientActivity(db.Model):
    __tablename__ = "client_activity"
    client_activity_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    client_id = db.Column(db.Integer, db.ForeignKey('client.client_id'), nullable=False)
    activity_id = db.Column(db.Integer, db.ForeignKey('activity_records.activity_id'), nullable=False)
    date = db.Column(db.DateTime, nullable=False)

# ---------------- SCHEMAS ----------------
class ClientSchema(Schema):
    client_id = fields.Int(dump_only=True)
    full_name = fields.Str(required=True, validate=validate.Length(min=1))
    # dob removed from schema
    gender = fields.Str(required=False, validate=validate.Length(max=2), allow_none=True)

class WashroomSchema(Schema):
    washroom_id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    washroom_type = fields.Str(required=True)
    time_in = fields.DateTime(required=True)
    time_out = fields.DateTime(required=False)
    date = fields.Date(required=True)

    @validates("time_out")
    def validate_time_out(self, value, **kwargs):
        """
        Validates that time_out is after time_in if provided.
        If time_out is missing, just logs a warning instead of raising an error.
        """
        if value is None:
            print("Warning: time_out not provided for this record")
            
    @validates('washroom_type')
    def validate_washroom_type(self, value, **kwargs):
        valid_types = ['A', 'B']
        if value not in valid_types:
            raise ValidationError(f"washroom_type must be one of {valid_types}")

class CoatCheckSchema(Schema):
    # align field name with model primary key (check_id)
    check_id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    bin_no = fields.Int(required=True)
    time_in = fields.DateTime(required=True)
    time_out = fields.DateTime(required=False)
    date = fields.Date(required=True)

    @validates("time_out")
    def validate_time_out(self, value, **kwargs):
        """
        Validates that time_out is after time_in if provided.
        If time_out is missing, just logs a warning instead of raising an error.
        """
        if value is None:
            print("Warning: time_out not provided for this record")

    @validates('bin_no')
    def validate_bin_no(self, value, **kwargs):
        if value < 1 or value > 100:
            raise ValidationError("bin_no must be between 1 and 100")

class SanctuarySchema(Schema):
    sanctuary_id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    date = fields.Date(required=True)
    time_in = fields.DateTime(required=True)
    time_out = fields.DateTime(required=False)
    purpose_of_visit = fields.Str(required=False)
    if_serviced = fields.Bool(required=True)

    @validates("time_out")
    def validate_time_out(self, value, **kwargs):
        """
        Validates that time_out is after time_in if provided.
        If time_out is missing, just logs a warning instead of raising an error.
        """
        if value is None:
            print("Warning: time_out not provided for this record")

class ClinicSchema(Schema):
    clinic_id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    date = fields.Date(required=True)
    purpose_of_visit = fields.Str(required=False, validate=validate.Length(min=1))

    @validates('date')
    def validate_date(self, value, **kwargs):
        if value > date.today():
            raise ValidationError("date cannot be in the future")

class SafeSleepSchema(Schema):
    sleep_id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    bed_no = fields.Int(required=False, allow_none=True)
    is_occupied = fields.Bool(required=False)
    date = fields.DateTime(required=True)

    @validates('date')
    def validate_date(self, value, **kwargs):
        from datetime import datetime
        if value > datetime.now():
            raise ValidationError('date cannot be in the future')

    @validates('bed_no')
    def validate_bed_no(self, value, **kwargs):
        if value is None:
            return
        if value < 1 or value > 20:
            raise ValidationError('bed_no must be between 1 and 20')

class ActivitySchema(Schema):
    activity_id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    activity_name = fields.Str(required=True, validate=validate.Length(min=1))
    date = fields.Date(required=True)

class ClientActivitySchema(Schema):
    client_activity_id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    activity_id = fields.Int(required=True)
    date = fields.DateTime(required=True)

# ---------------- ROUTES ----------------
# testing
@app.route("/data_clean/client", methods=["POST"])
def clean_clients():
    # run simple cleaning operations inline to avoid import/app-context issues
    # 1) standardize client names
    clients = Client.query.all()
    standardized = 0
    for client in clients:
        clean_name = client.full_name.strip().title()
        if client.full_name != clean_name:
            client.full_name = clean_name
            standardized += 1

    # 2) remove duplicate clients (same full_name), keep lowest client_id
    duplicates = (
        db.session.query(Client.full_name, func.count(Client.client_id))
        .group_by(Client.full_name)
        .having(func.count(Client.client_id) > 1)
        .all()
    )
    removed = 0
    for name, cnt in duplicates:
        duplicates_to_delete = (
            Client.query.filter_by(full_name=name)
            .order_by(Client.client_id.asc())
            .offset(1)
            .all()
        )
        for dup in duplicates_to_delete:
            db.session.delete(dup)
            removed += 1

    db.session.commit()
    return jsonify({"standardized": standardized, "removed": removed}), 200

# exporting route into excel file for any table
@app.route("/export/<string:table_name>", methods=["GET"])
def export_table(table_name):
    # map table names to SQLAlchemy models
    models = {
        "client": Client,
        "washroom_records": WashroomRecord,
        "coat_check_records": CoatCheckRecord,
        "sanctuary_records": SanctuaryRecord,
        "safe_sleep_records": SafeSleepRecord,
        "clinic_records": ClinicRecord,
        "activity_records": Activity,
        "client_activity": ClientActivity
    }

    # validation if table exists
    if table_name not in models:
        return jsonify({"message": "Table not found"}), 404
    
    # fetch all rows from the table using SQLAlchemy
    model = models[table_name]
    query = model.query.all()

    # if table entry, return 404 code
    if not query:
        return jsonify({"message": "No data found in the table"}), 404
    
    # convert to pandas DataFrame
    try:
        df = pd.DataFrame([row.__dict__ for row in query])
        df.drop(columns=["_sa_instance_state"], inplace=True, errors='ignore')

        # export to excel in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, sheet_name=table_name[:31])  # Excel sheet names limited to 31 chars
        
        output.seek(0)
        # send file as response
        return send_file(
            output,
            as_attachment=True,
            download_name=f"{table_name}.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"message": "Error exporting table", "error": str(e)}), 500

# POST requests to create records

@app.route("/client", methods=["POST"])
def create_client():
    payload = request.json

    try:
        data = ClientSchema().load(payload)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    # Normalize full_name to capitalized initials (e.g. "ruby rose" -> "Ruby Rose")
    if data.get('full_name'):
        parts = [p for p in str(data['full_name']).strip().split() if p]
        data['full_name'] = ' '.join([p.capitalize() for p in parts])

    # check if duplicate exists in the clients table (match by name only)
    existing = Client.query.filter_by(full_name=data["full_name"]).first()
    if existing:
        return jsonify({"message": "Client exists", "client_id": existing.client_id}), 409
    
    client = Client(**data)
    try:
        db.session.add(client)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Client created", "client_id": client.client_id}), 201

@app.route("/washroom_records", methods=["POST"])
def create_washroom_record():
    payload = request.json

    try:
        data = WashroomSchema().load(payload)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # check if time_out > time_in
    if data.get("time_out") is not None and data["time_out"] <= data["time_in"]:
        return jsonify({"message": "time_out must be after time_in"}), 400

    # ensure client exists
    client = Client.query.get(data["client_id"])
    if not client:
        return jsonify({"message": "Client not found"}), 404
    
    was = WashroomRecord(**data)
    try:
        db.session.add(was)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Washroom record created", "washroom_id": was.washroom_id}), 201

@app.route("/coat_check_records", methods=["POST"])
def create_coat_check_record():
    payload = request.json

    try:
        data = CoatCheckSchema().load(payload)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # check if time_out > time_in
    if data.get("time_out") is not None and data["time_out"] <= data["time_in"]:
        return jsonify({"message": "time_out must be after time_in"}), 400
    
    # validate bin no
    if data.get("bin_no") is not None and (data["bin_no"] < 1 or data["bin_no"] > 100):
        return jsonify({"message": "bin_no must be between 1 and 100"}), 400

    
    # ensure client exists
    client = Client.query.get(data["client_id"])
    if not client:
        return jsonify({"message": "Client not found"}), 404
    
    coat = CoatCheckRecord(**data)
    try:
        db.session.add(coat)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Coat check record created", "check_id": coat.check_id}), 201    

@app.route("/sanctuary_records", methods=["POST"])
def create_sanctuary_record():
    payload = request.json or {}
    # defensive: remove any provided primary key before validation
    payload.pop('sanctuary_id', None)

    try:
        data = SanctuarySchema().load(payload)
        print("[DEBUG] create_sanctuary_record (second) marshalled data:", data)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # check if time_out > time_in
    if data.get("time_out") is not None and data["time_out"] <= data["time_in"]:
        return jsonify({"message": "time_out must be after time_in"}), 400
    
    # ensure client exists
    client = Client.query.get(data["client_id"])
    if not client:
        return jsonify({"message": "Client not found"}), 404
    
    # Defensive: construct a clean payload dict to avoid passing sanctuary_id
    clean = {
        'client_id': data.get('client_id'),
        'date': data.get('date'),
        'time_in': data.get('time_in'),
        'time_out': data.get('time_out'),
        'purpose_of_visit': data.get('purpose_of_visit'),
        'if_serviced': data.get('if_serviced', False)
    }

    sanc = SanctuaryRecord(**clean)
    try:
        db.session.add(sanc)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Sanctuary record created", "sanctuary_id": sanc.sanctuary_id}), 201

@app.route("/clinic_records", methods=["POST"])
def create_clinic_record():
    payload = request.json

    try:
        data = ClinicSchema().load(payload)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # check if data is valid and not in the future
    if data["date"] > date.today():
        return jsonify({"message": "date cannot be in the future"}), 400
    
    # ensure client exists
    client = Client.query.get(data["client_id"])
    if not client:
        return jsonify({"message": "Client not found"}), 404
    
    clinic = ClinicRecord(**data)
    try:
        db.session.add(clinic)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Clinic record created", "clinic_id": clinic.clinic_id}), 201

@app.route("/safe_sleep_records", methods=["POST"])
def create_safe_sleep_record():
    payload = request.json

    try:
        data = SafeSleepSchema().load(payload)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # ensure client exists
    client = Client.query.get(data["client_id"])
    if not client:
        return jsonify({"message": "Client not found"}), 404
    # ensure bed_no/is_occupied defaults when not provided
    if 'is_occupied' not in data:
        data['is_occupied'] = True if data.get('bed_no') else False

    # ensure date/time present and valid
    from datetime import datetime
    if 'date' not in data or data['date'] is None:
        data['date'] = datetime.now()
    else:
        if data['date'] > datetime.now():
            return jsonify({"message": "date cannot be in the future"}), 400

    safe_sleep = SafeSleepRecord(**data)
    try:
        db.session.add(safe_sleep)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Safe sleep record created", "sleep_id": safe_sleep.sleep_id}), 201

@app.route("/activity", methods=["POST"])
def create_activity():
    payload = request.json

    try:
        data = ActivitySchema().load(payload)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    # validate start/end times when provided
    if data.get('start_time') is not None and data.get('end_time') is not None:
        try:
            if data['end_time'] <= data['start_time']:
                return jsonify({"message": "end_time must be after start_time"}), 400
        except Exception:
            return jsonify({"message": "Invalid start_time/end_time values"}), 400

    activity = Activity(**data)
    try:
        db.session.add(activity)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Activity created", "activity_id": activity.activity_id}), 201

@app.route("/client_activity", methods=["POST"])
def create_client_activity():
    payload = request.json

    try:
        data = ClientActivitySchema().load(payload)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # ensure client exists
    client = Client.query.get(data["client_id"])
    if not client:
        return jsonify({"message": "Client not found"}), 404
    
    # ensure activity exists
    activity = Activity.query.get(data["activity_id"])
    if not activity:
        return jsonify({"message": "Activity not found"}), 404
    
    client_activity = ClientActivity(**data)
    try:
        db.session.add(client_activity)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Client activity created", "client_activity_id": client_activity.client_activity_id}), 201


# GET requests to get records

# get all clients
@app.route("/client", methods=["GET"])
def get_clients():
    full_name = request.args.get("full_name")
    query = Client.query

    if full_name:
        query = query.filter(Client.full_name.ilike(f"%{full_name}%"))
    clients = query.all()
    data = ClientSchema(many=True).dump(clients)
    return jsonify(data), 200

# get client by id
@app.route("/client/<int:client_id>", methods=["GET"])
def get_client(client_id):
    client = Client.query.get(client_id)
    if not client:
        return jsonify({"message": "Client not found"}), 404
    
    data = ClientSchema().dump(client)
    return jsonify(data), 200


# Backend compatibility endpoints for frontend
@app.route('/api/clients', methods=['GET'])
def api_get_clients():
    """Compatibility wrapper: supports `?query=` used by frontend SearchBar.
    Returns an array of clients matching `full_name` (case-insensitive contains).
    If no query provided, returns all clients (capped for safety).
    """
    query_param = request.args.get('query')
    q = Client.query
    if query_param:
        q = q.filter(Client.full_name.ilike(f"%{query_param}%"))
    # Safety: cap to 200 results to avoid huge responses
    clients = q.limit(200).all()
    data = ClientSchema(many=True).dump(clients)
    return jsonify(data), 200


@app.route('/api/clients/recent', methods=['GET'])
def api_recent_clients():
    """Return a small list of recent clients based on most recent service records.
    The endpoint aggregates recent records from service tables and returns
    unique clients ordered by most-recent service date. Each entry includes:
    { id, name, date, service }
    """
    try:
        limit = int(request.args.get('limit', 10))
    except Exception:
        limit = 10

    records = []

    # Helper to append records; prefer time_in if available for ordering
    def push_records(queryset, service_name, has_time_in=False):
        for r in queryset:
            # r may be a model instance
            rec_date = None
            rec_dt = None
            if has_time_in and hasattr(r, 'time_in') and r.time_in is not None:
                rec_dt = r.time_in
            elif hasattr(r, 'date') and r.date is not None:
                # convert date to a datetime at midnight for ordering
                from datetime import datetime
                rec_dt = datetime.combine(r.date, datetime.min.time())
            records.append({'client_id': r.client_id, 'datetime': rec_dt, 'date': getattr(r, 'date', None), 'service': service_name})

    # Collect recent records from different service tables
    push_records(CoatCheckRecord.query.order_by(CoatCheckRecord.date.desc()).limit(limit).all(), 'Coat Check', has_time_in=True)
    push_records(WashroomRecord.query.order_by(WashroomRecord.date.desc()).limit(limit).all(), 'Washroom', has_time_in=True)
    push_records(SanctuaryRecord.query.order_by(SanctuaryRecord.date.desc()).limit(limit).all(), 'Sanctuary', has_time_in=True)
    push_records(ClinicRecord.query.order_by(ClinicRecord.date.desc()).limit(limit).all(), 'Clinic', has_time_in=False)
    push_records(SafeSleepRecord.query.order_by(SafeSleepRecord.date.desc()).limit(limit).all(), 'Safe Sleep', has_time_in=False)

    # Ensure all records have a datetime for ordering. If missing, set a very old fallback
    from datetime import datetime
    for r in records:
        if r['datetime'] is None:
            r['datetime'] = datetime.min

    # Sort by datetime descending (fallback datetimes will appear last)
    records.sort(key=lambda x: x['datetime'], reverse=True)

    # Map records into output rows, resolving client name when possible.
    SERVICE_COLORS = {
        'Coat Check': '#FE2323',
        'Washroom': '#6ECAEE',
        'Sanctuary': '#D9F373',
        'Clinic': '#FA488F',
        'Safe Sleep': '#2C3B9C',
    }

    mapped = []
    for r in records:
        cid = r.get('client_id')
        client = Client.query.get(cid)
        name = client.full_name if client else f"Client #{cid}"
        date_str = r['date'].isoformat() if r['date'] else (r['datetime'].date().isoformat() if r['datetime'] else None)
        mapped.append({
            'client_id': cid,
            'id': cid,
            'name': name,
            'date': date_str,
            'service': r.get('service'),
            'color': SERVICE_COLORS.get(r.get('service'), '#CCCCCC')
        })

    # If dedupe param is provided, return unique clients preserving order
    if request.args.get('dedupe') == '1':
        seen = set()
        recent_clients = []
        for m in mapped:
            cid = m['client_id']
            if cid in seen:
                continue
            seen.add(cid)
            recent_clients.append(m)
            if len(recent_clients) >= limit:
                break
        # Debug: also return raw records if requested
        if request.args.get('debug') == '1':
            return jsonify({'raw_records': [{
                'client_id': r['client_id'],
                'datetime': (r['date'] if isinstance(r['date'], str) else None),
                'date': r['date'],
                'service': r['service']
            } for r in mapped], 'recent_clients': recent_clients}), 200
        return jsonify(recent_clients), 200

    # Default: return mapped service records (one per record), limited
    result = mapped[:limit]
    if request.args.get('debug') == '1':
        return jsonify({'raw_records': [{
            'client_id': r['client_id'],
            'datetime': (r['date'] if isinstance(r['date'], str) else None),
            'date': r['date'],
            'service': r['service']
        } for r in mapped], 'recent_clients': result}), 200
    return jsonify(result), 200

# get all washroom records & filter by client_id and date
@app.route("/washroom_records", methods=["GET"])
def get_washroom_records():
    client_id = request.args.get("client_id")
    date_str = request.args.get("date")
    query = WashroomRecord.query

    if client_id:
        query = query.filter_by(client_id=client_id)
    if date_str:
        query = query.filter_by(date=date_str)
    
    records = query.all()
    data = WashroomSchema(many=True).dump(records)
    return jsonify(data), 200

@app.route("/washroom_records/<int:washroom_id>", methods=["GET"])
def get_washroom_record(washroom_id):
    record = WashroomRecord.query.get(washroom_id)
    if not record:
        return jsonify({"message": "Washroom record not found"}), 404
    data = WashroomSchema().dump(record)
    return jsonify(data), 200

# get all coat check records & filter by client_id and date
@app.route("/coat_check_records", methods=["GET"])
def get_coat_check_records():
    client_id = request.args.get("client_id")
    date_str = request.args.get("date")
    bin_no = request.args.get("bin_no")
    query = CoatCheckRecord.query

    if client_id:
        query = query.filter_by(client_id=client_id)
    if date_str:
        query = query.filter_by(date=date_str)
    if bin_no:
        query = query.filter_by(bin_no=bin_no)
    
    records = query.all()
    data = CoatCheckSchema(many=True).dump(records)
    return jsonify(data), 200

@app.route("/coat_check_records/<int:check_id>", methods=["GET"])
def get_coat_check_record(check_id):
    record = CoatCheckRecord.query.get(check_id)
    if not record:
        return jsonify({"message": "Coat check record not found"}), 404
    data = CoatCheckSchema().dump(record)
    return jsonify(data), 200

# get all sanctuary records & filter by client_id and date
@app.route("/sanctuary_records", methods=["GET"])
def get_sanctuary_records():
    client_id = request.args.get("client_id")
    date_str = request.args.get("date")
    query = SanctuaryRecord.query

    if client_id:
        query = query.filter_by(client_id=client_id)
    if date_str:
        query = query.filter_by(date=date_str)
    
    records = query.all()
    data = SanctuarySchema(many=True).dump(records)
    return jsonify(data), 200

@app.route("/sanctuary_records/<int:sanctuary_id>", methods=["GET"])
def get_sanctuary_record(sanctuary_id):
    record = SanctuaryRecord.query.get(sanctuary_id)
    if not record:
        return jsonify({"message": "Sanctuary record not found"}), 404
    data = SanctuarySchema().dump(record)
    return jsonify(data), 200

# get all clinic records & filter by client_id and date
@app.route("/clinic_records", methods=["GET"])   
def get_clinic_records():
    client_id = request.args.get("client_id")
    date_str = request.args.get("date")
    query = ClinicRecord.query

    if client_id:
        query = query.filter_by(client_id=client_id)
    if date_str:
        query = query.filter_by(date=date_str)
    
    records = query.all()
    data = ClinicSchema(many=True).dump(records)
    return jsonify(data), 200

@app.route("/clinic_records/<int:clinic_id>", methods=["GET"])
def get_clinic_record(clinic_id):
    record = ClinicRecord.query.get(clinic_id)
    if not record:
        return jsonify({"message": "Clinic record not found"}), 404
    data = ClinicSchema().dump(record)
    return jsonify(data), 200

@app.route("/safe_sleep_records", methods=["GET"])
def get_safe_sleep_records():
    client_id = request.args.get("client_id")
    date_str = request.args.get("date")
    query = SafeSleepRecord.query

    if client_id:
        query = query.filter_by(client_id=client_id)
    if date_str:
        query = query.filter_by(date=date_str)
    
    records = query.all()
    data = SafeSleepSchema(many=True).dump(records)
    return jsonify(data), 200

@app.route("/safe_sleep_records/<int:sleep_id>", methods=["GET"])
def get_safe_sleep_record(sleep_id):
    record = SafeSleepRecord.query.get(sleep_id)
    if not record:
        return jsonify({"message": "Safe sleep record not found"}), 404
    data = SafeSleepSchema().dump(record)
    return jsonify(data), 200

# get all activities
@app.route("/activity", methods=["GET"])
def get_activities():
    activity_name = request.args.get("activity_name")
    query = Activity.query

    if activity_name:
        query = query.filter(Activity.activity_name.ilike(f"%{activity_name}%"))
    activities = query.all()

    data = ActivitySchema(many=True).dump(activities)
    return jsonify(data), 200

@app.route("/activity/<int:activity_id>", methods=["GET"])
def get_activity(activity_id):
    activity = Activity.query.get(activity_id)
    if not activity:
        return jsonify({"message": "Activity not found"}), 404
    
    data = ActivitySchema().dump(activity)
    return jsonify(data), 200

# get all client activities & filter by client_id, activity_id, and date
@app.route("/client_activity", methods=["GET"])
def get_client_activity():
    client_id = request.args.get("client_id")
    activity_id = request.args.get("activity_id")
    start = request.args.get('start_date')
    end = request.args.get('end_date')
    query = ClientActivity.query

    if client_id:
        query = query.filter_by(client_id=client_id)
    if activity_id:
        query = query.filter_by(activity_id=activity_id)

    try:
        if start:
            sd = datetime.fromisoformat(start).date()
            query = query.filter(ClientActivity.date >= sd)
        if end:
            ed = datetime.fromisoformat(end).date()
            query = query.filter(ClientActivity.date <= ed)
    except Exception:
        return jsonify({'message': 'Invalid date format for start_date/end_date, use YYYY-MM-DD'}), 400

    records = query.all()
    mapped = []
    for r in records:
        client = Client.query.get(r.client_id)
        activity = Activity.query.get(r.activity_id)
        mapped.append({
            'client_activity_id': r.client_activity_id,
            'client_id': r.client_id,
            'client_name': client.full_name if client else None,
            'activity_id': r.activity_id,
            'activity_name': activity.activity_name if activity else None,
            'date': r.date.isoformat() if r.date else None,
            'score': getattr(r, 'score', None)
        })
    return jsonify(mapped), 200

@app.route("/client_activity/<int:client_activity_id>", methods=["GET"])
def get_client_activity_record(client_activity_id):
    record = ClientActivity.query.get(client_activity_id)
    if not record:
        return jsonify({"message": "Client activity record not found"}), 404
    client = Client.query.get(record.client_id)
    activity = Activity.query.get(record.activity_id)
    data = {
        'client_activity_id': record.client_activity_id,
        'client_id': record.client_id,
        'client_name': client.full_name if client else None,
        'activity_id': record.activity_id,
        'activity_name': activity.activity_name if activity else None,
        'date': record.date.isoformat() if record.date else None,
        'score': getattr(record, 'score', None)
    }
    return jsonify(data), 200


# PUT requests to update records

# update client id 
@app.route("/client/<int:client_id>", methods=["PUT"])
def update_client(client_id):
    payload = request.json
    client = Client.query.get(client_id)
    if not client:
        return jsonify({"message": "Client not found"}), 404

    try:
        data = ClientSchema().load(payload, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    for key, value in data.items():
        setattr(client, key, value)
    
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Client updated"}), 200

# update coact check records
@app.route("/coat_check_records/<int:check_id>", methods=["PUT"])
def update_coat_check_record(check_id):
    payload = request.json
    record = CoatCheckRecord.query.get(check_id)
    if not record:
        return jsonify({"message": "Coat check record not found"}), 404
    
    try:
        data = CoatCheckSchema().load(payload, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # validations for bin no and time_in/out
    if "time_out" in data and "time_in" in data:
        if data["time_out"] <= data["time_in"]:
            return jsonify({"message": "time_out must be after time_in"}), 400
        
    if "bin_no" in data and (data["bin_no"] < 1 or data["bin_no"] > 100):
        return jsonify({"message": "bin_no must be between 1 and 100"}), 400
    
    for key, value in data.items():
        setattr(record, key, value)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Coat check record updated"}), 200

# update washroom records
@app.route("/washroom_records/<int:washroom_id>", methods=["PUT"])
def update_washroom_record(washroom_id):
    payload = request.json
    record = WashroomRecord.query.get(washroom_id)
    if not record:
        return jsonify({"message": "Washroom record not found"}), 404
    
    try:
        data = WashroomSchema().load(payload, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # validations for washroom_type and time_in/out
    if "time_out" in data and "time_in" in data:
        if data["time_out"] <= data["time_in"]:
            return jsonify({"message": "time_out must be after time_in"}), 400
        
    if "washroom_type" in data:
        valid_types = ['A', 'B']
        if data["washroom_type"] not in valid_types:
            return jsonify({"message": f"washroom_type must be one of {valid_types}"}), 400
    
    for key, value in data.items():
        setattr(record, key, value)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Washroom record updated"}), 200

# update sanctuary records
@app.route("/sanctuary_records/<int:sanctuary_id>", methods=["PUT"])
def update_sanctuary_record(sanctuary_id):
    payload = request.json
    record = SanctuaryRecord.query.get(sanctuary_id)
    if not record:
        return jsonify({"message": "Sanctuary record not found"}), 404
    
    try:
        data = SanctuarySchema().load(payload, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # validations for time_in/out
    if "time_out" in data and "time_in" in data:
        if data["time_out"] <= data["time_in"]:
            return jsonify({"message": "time_out must be after time_in"}), 400
    
    for key, value in data.items():
        setattr(record, key, value)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Sanctuary record updated"}), 200

# update clinic records
@app.route("/clinic_records/<int:clinic_id>", methods=["PUT"])
def update_clinic_record(clinic_id):
    payload = request.json
    record = ClinicRecord.query.get(clinic_id)
    if not record:
        return jsonify({"message": "Clinic record not found"}), 404
    try:
        data = ClinicSchema().load(payload, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    for key, value in data.items():
        setattr(record, key, value)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    return jsonify({"message": "Clinic record updated"}), 200

# update safe sleep records
@app.route("/safe_sleep_records/<int:sleep_id>", methods=["PUT"])
def update_safe_sleep_record(sleep_id):
    payload = request.json
    record = SafeSleepRecord.query.get(sleep_id)
    if not record:
        return jsonify({"message": "Safe sleep record not found"}), 404
    try:
        data = SafeSleepSchema().load(payload, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    for key, value in data.items():
        setattr(record, key, value)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Safe sleep record updated"}), 200

# update activity
@app.route("/activity/<int:activity_id>", methods=["PUT"])
def update_activity(activity_id):
    activity = Activity.query.get(activity_id)
    if not activity:
        return jsonify({"message": "Activity not found"}), 404
    payload = request.json

    try:
        data = ActivitySchema().load(payload, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    # validate start/end time relationship when both present
    if 'start_time' in data and 'end_time' in data:
        try:
            if data['end_time'] <= data['start_time']:
                return jsonify({"message": "end_time must be after start_time"}), 400
        except Exception:
            return jsonify({"message": "Invalid start_time/end_time values"}), 400

    for key, value in data.items():
        setattr(activity, key, value)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Activity updated"}), 200

# update client activity
@app.route("/client_activity/<int:client_activity_id>", methods=["PUT"])
def update_client_activity(client_activity_id):
    record = ClientActivity.query.get(client_activity_id)
    if not record:
        return jsonify({"message": "Client activity record not found"}), 404
    payload = request.json

    try:
        data = ClientActivitySchema().load(payload, partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # ensuring linked records still exist
    if "client_id" in data and not Client.query.get(data["client_id"]):
        return jsonify({"message": "Client not found"}), 404
    
    if "activity_id" in data and not Activity.query.get(data["activity_id"]):
        return jsonify({"message": "Activity not found"}), 404
    
    for key, value in data.items():
        setattr(record, key, value)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Client activity record updated"}), 200

# DELETE requests to delete records

# delete client by id
@app.route("/client/<int:client_id>", methods=["DELETE"])
def delete_client(client_id):
    client = Client.query.get(client_id)

    if not client:
        return jsonify({"message": "Client not found"}), 404
    try:
        db.session.delete(client)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Client deleted"}), 200

# delete washroom record by id
@app.route("/washroom_records/<int:washroom_id>", methods=["DELETE"])
def delete_washroom_record(washroom_id):
    record = WashroomRecord.query.get(washroom_id)

    if not record:
        return jsonify({"message": "Washroom record not found"}), 404
    try:
        db.session.delete(record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Washroom record deleted"}), 200

# delete coat check record by id
@app.route("/coat_check_records/<int:check_id>", methods=["DELETE"])
def delete_coat_check_record(check_id):
    record = CoatCheckRecord.query.get(check_id)

    if not record:
        return jsonify({"message": "Coat check record not found"}), 404
    try:
        db.session.delete(record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Coat check record deleted"}), 200

# delete sanctuary record by id
@app.route("/sanctuary_records/<int:sanctuary_id>", methods=["DELETE"])
def delete_sanctuary_record(sanctuary_id):
    record = SanctuaryRecord.query.get(sanctuary_id)

    if not record:
        return jsonify({"message": "Sanctuary record not found"}), 404
    try:
        db.session.delete(record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Sanctuary record deleted"}), 200

# delete clinic record by id
@app.route("/clinic_records/<int:clinic_id>", methods=["DELETE"])
def delete_clinic_record(clinic_id):
    record = ClinicRecord.query.get(clinic_id)

    if not record:
        return jsonify({"message": "Clinic record not found"}), 404
    try:
        db.session.delete(record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Clinic record deleted"}), 200

# delete safe sleep record by id
@app.route("/safe_sleep_records/<int:sleep_id>", methods=["DELETE"])
def delete_safe_sleep_record(sleep_id):
    record = SafeSleepRecord.query.get(sleep_id)

    if not record:
        return jsonify({"message": "Safe sleep record not found"}), 404
    try:
        db.session.delete(record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Safe sleep record deleted"}), 200

# delete activity by id
@app.route("/activity/<int:activity_id>", methods=["DELETE"])
def delete_activity(activity_id):
    activity = Activity.query.get(activity_id)

    if not activity:
        return jsonify({"message": "Activity not found"}), 404
    try:
        db.session.delete(activity)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Activity deleted"}), 200

# delete client activity record by id
@app.route("/client_activity/<int:client_activity_id>", methods=["DELETE"])
def delete_client_activity(client_activity_id):
    record = ClientActivity.query.get(client_activity_id)

    if not record:
        return jsonify({"message": "Client activity record not found"}), 404
    try:
        db.session.delete(record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Client activity record deleted"}), 200

    client = Client.query.get(client_id)
    if not client:
        return jsonify({"message": "Client not found"}), 404
    
    data = ClientSchema().dump(client)
    return jsonify(data), 200



# ---------------- AUTHENTICATION ----------------
@app.route('/api/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "message": "No data provided"
            }), 400
        
        username = data.get('username')
        password = data.get('password')
        
        # Hardcoded credentials
        if username == 'adminuser' and password == 'Admin2025!':
            return jsonify({
                "success": True,
                "message": "Login successful"
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": "Invalid username or password"
            }), 401
    except Exception as e:
        return jsonify({
            "success": False,
            "message": "An error occurred during login",
            "error": str(e)
        }), 500

# run the app if this file is executed directly
if __name__ == '__main__':
    app.run(debug=True)
