from flask import Flask
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from marshmallow import Schema, fields, validate, validates, ValidationError
from datetime import date
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
            db.session.commit()
    except Exception:
        # don't crash startup if we can't fix schema here; log to stdout
        print('Warning: could not verify or modify washroom_records constraints')

# Run schema fix at import time (safe no-op if DB not available)
fix_schema_constraints()

# ---------------- MODELS ----------------
class Client(db.Model):
    __tablename__ = "client"
    client_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    full_name = db.Column(db.String(255), nullable=False)
    dob = db.Column(db.Date, nullable=True)
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
    date = db.Column(db.Date, nullable=False)

class Activity(db.Model):
    __tablename__ = "activity_records"
    activity_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    client_id = db.Column(db.Integer, nullable=False)
    activity_name = db.Column(db.String(255), nullable=False)
    date = db.Column(db.Date, nullable=False)

class ClientActivity(db.Model):
    __tablename__ = "client_activity"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    client_id = db.Column(db.Integer, db.ForeignKey('client.client_id'), nullable=False)
    activity_id = db.Column(db.Integer, db.ForeignKey('activity_records.activity_id'), nullable=False)
    date = db.Column(db.Date, nullable=False)

# ---------------- SCHEMAS ----------------
class ClientSchema(Schema):
    client_id = fields.Int(dump_only=True)
    full_name = fields.Str(required=True, validate=validate.Length(min=1))
    dob = fields.Date(required=False)
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
    date = fields.Date(required=True)

class ActivitySchema(Schema):
    activity_id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    activity_name = fields.Str(required=True, validate=validate.Length(min=1))
    date = fields.Date(required=True)

class ClientActivitySchema(Schema):
    id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    activity_id = fields.Int(required=True)
    date = fields.Date(required=True)

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

    # 2) remove duplicate clients (same full_name and dob), keep lowest client_id
    duplicates = (
        db.session.query(Client.full_name, Client.dob, func.count(Client.client_id))
        .group_by(Client.full_name, Client.dob)
        .having(func.count(Client.client_id) > 1)
        .all()
    )
    removed = 0
    for name, dob, cnt in duplicates:
        duplicates_to_delete = (
            Client.query.filter_by(full_name=name, dob=dob)
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
    
    # check if duplicates exists in the clients table
    existing = Client.query.filter_by(full_name=data["full_name"], dob=data.get("dob")).first()
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
    payload = request.json

    try:
        data = SanctuarySchema().load(payload)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # check if time_out > time_in
    if data.get("time_out") is not None and data["time_out"] <= data["time_in"]:
        return jsonify({"message": "time_out must be after time_in"}), 400
    
    # ensure client exists
    client = Client.query.get(data["client_id"])
    if not client:
        return jsonify({"message": "Client not found"}), 404
    
    sanc = SanctuaryRecord(**data)
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
    
    return jsonify({"message": "Client activity created", "id": client_activity.id}), 201


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
    { id, name, dob, date, service }
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
    push_records(ClientActivity.query.order_by(ClientActivity.date.desc()).limit(limit).all(), 'Activity', has_time_in=False)

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
        'Activity': '#A8A8A8'
    }

    mapped = []
    for r in records:
        cid = r.get('client_id')
        client = Client.query.get(cid)
        name = client.full_name if client else f"Client #{cid}"
        dob = client.dob.isoformat() if client and client.dob else None
        date_str = r['date'].isoformat() if r['date'] else (r['datetime'].date().isoformat() if r['datetime'] else None)
        mapped.append({
            'client_id': cid,
            'id': cid,
            'name': name,
            'dob': dob,
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
    query = ClientActivity.query

    if client_id:
        query = query.filter_by(client_id=client_id)
    if activity_id:
        query = query.filter_by(activity_id=activity_id)

    records = query.all()
    data = ClientActivitySchema(many=True).dump(records)
    return jsonify(data), 200

@app.route("/client_activity/<int:id>", methods=["GET"])
def get_client_activity_record(id):
    record = ClientActivity.query.get(id)
    if not record:
        return jsonify({"message": "Client activity record not found"}), 404
    data = ClientActivitySchema().dump(record)
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
    
    for key, value in data.items():
        setattr(activity, key, value)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Activity updated"}), 200

# update client activity
@app.route("/client_activity/<int:id>", methods=["PUT"])
def update_client_activity(id):
    record = ClientActivity.query.get(id)
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
@app.route("/client_activity/<int:id>", methods=["DELETE"])
def delete_client_activity(id):
    record = ClientActivity.query.get(id)

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

        activity_clients = db.session.query(ClientActivity.client_id).filter(
            ClientActivity.date >= start_date,
            ClientActivity.date <= end_date
        ).distinct().all()
        client_ids.update([c[0] for c in activity_clients])

        total_clients = len(client_ids)

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

        safe_sleep_count = db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(
            SafeSleepRecord.date >= start_date,
            SafeSleepRecord.date <= end_date
        ).scalar() or 0

        # Count activity records (activities attended)
        activity_count = db.session.query(func.count(Activity.activity_id)).filter(
            Activity.date >= start_date,
            Activity.date <= end_date
        ).scalar() or 0

        service_breakdown = {
            'Coat Check': int(coat_check_count),
            'Washroom': int(washroom_count),
            'Sanctuary': int(sanctuary_count),
            'Clinic': int(clinic_count),
            'Safe Sleep': int(safe_sleep_count)
        }
        # include activities in breakdown
        service_breakdown['Activity'] = int(activity_count)

        # total_clients should represent total service usages (sum of all service counts)
        total_clients = int(coat_check_count + washroom_count + sanctuary_count + clinic_count + safe_sleep_count + activity_count)
        
        # Get hourly/daily/monthly data for the chart
        chart_data = []
        
        if time_range == 'day':
            # Group by hour (9am to 6pm) and count service entries (not unique clients)
            for hour in range(9, 19):  # 9am to 6pm
                hour_start = datetime.combine(today, datetime.min.time().replace(hour=hour))
                hour_end = hour_start + timedelta(hours=1)

                hour_total = 0
                hour_total += db.session.query(func.count(WashroomRecord.washroom_id)).filter(
                    WashroomRecord.time_in >= hour_start,
                    WashroomRecord.time_in < hour_end
                ).scalar() or 0
                hour_total += db.session.query(func.count(CoatCheckRecord.check_id)).filter(
                    CoatCheckRecord.time_in >= hour_start,
                    CoatCheckRecord.time_in < hour_end
                ).scalar() or 0
                hour_total += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(
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
                day_total = 0
                day_total += db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(ClinicRecord.clinic_id)).filter(ClinicRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(SafeSleepRecord.date == day_date).scalar() or 0
                # include activity records by date
                day_total += db.session.query(func.count(Activity.activity_id)).filter(Activity.date == day_date).scalar() or 0

                chart_data.append({
                    'label': days[i],
                    'value': int(day_total)
                })
        
        elif time_range == 'month':
            # Group by day, but only show every few days to avoid crowding
            days_in_month = (end_date - start_date).days + 1
            step = max(1, days_in_month // 10)  # Show ~10 data points
            
            for i in range(0, days_in_month, step):
                day_date = start_date + timedelta(days=i)
                day_total = 0
                day_total += db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(ClinicRecord.clinic_id)).filter(ClinicRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(SafeSleepRecord.date == day_date).scalar() or 0
                # include activity records for the month grouping
                day_total += db.session.query(func.count(Activity.activity_id)).filter(Activity.date == day_date).scalar() or 0

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

                month_total = 0
                month_total += db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.date >= month_start, WashroomRecord.date <= month_end).scalar() or 0
                month_total += db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.date >= month_start, CoatCheckRecord.date <= month_end).scalar() or 0
                month_total += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.date >= month_start, SanctuaryRecord.date <= month_end).scalar() or 0
                month_total += db.session.query(func.count(ClinicRecord.clinic_id)).filter(ClinicRecord.date >= month_start, ClinicRecord.date <= month_end).scalar() or 0
                month_total += db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(SafeSleepRecord.date >= month_start, SafeSleepRecord.date <= month_end).scalar() or 0
                # include activity records in monthly aggregation
                month_total += db.session.query(func.count(Activity.activity_id)).filter(Activity.date >= month_start, Activity.date <= month_end).scalar() or 0

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
    dob = db.Column(db.Date, nullable=True)
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
    date = db.Column(db.Date, nullable=False)

class Activity(db.Model):
    __tablename__ = "activity_records"
    activity_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    client_id = db.Column(db.Integer, nullable=False)
    activity_name = db.Column(db.String(255), nullable=False)
    date = db.Column(db.Date, nullable=False)

class ClientActivity(db.Model):
    __tablename__ = "client_activity"
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    client_id = db.Column(db.Integer, db.ForeignKey('client.client_id'), nullable=False)
    activity_id = db.Column(db.Integer, db.ForeignKey('activity_records.activity_id'), nullable=False)
    date = db.Column(db.Date, nullable=False)

# ---------------- SCHEMAS ----------------
class ClientSchema(Schema):
    client_id = fields.Int(dump_only=True)
    full_name = fields.Str(required=True, validate=validate.Length(min=1))
    dob = fields.Date(required=False)
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
    date = fields.Date(required=True)

class ActivitySchema(Schema):
    activity_id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    activity_name = fields.Str(required=True, validate=validate.Length(min=1))
    date = fields.Date(required=True)

class ClientActivitySchema(Schema):
    id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    activity_id = fields.Int(required=True)
    date = fields.Date(required=True)

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

    # 2) remove duplicate clients (same full_name and dob), keep lowest client_id
    duplicates = (
        db.session.query(Client.full_name, Client.dob, func.count(Client.client_id))
        .group_by(Client.full_name, Client.dob)
        .having(func.count(Client.client_id) > 1)
        .all()
    )
    removed = 0
    for name, dob, cnt in duplicates:
        duplicates_to_delete = (
            Client.query.filter_by(full_name=name, dob=dob)
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
    
    # check if duplicates exists in the clients table
    existing = Client.query.filter_by(full_name=data["full_name"], dob=data.get("dob")).first()
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
    payload = request.json

    try:
        data = SanctuarySchema().load(payload)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    # check if time_out > time_in
    if data.get("time_out") is not None and data["time_out"] <= data["time_in"]:
        return jsonify({"message": "time_out must be after time_in"}), 400
    
    # ensure client exists
    client = Client.query.get(data["client_id"])
    if not client:
        return jsonify({"message": "Client not found"}), 404
    
    sanc = SanctuaryRecord(**data)
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
    
    return jsonify({"message": "Client activity created", "id": client_activity.id}), 201


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
    { id, name, dob, date, service }
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
    push_records(ClientActivity.query.order_by(ClientActivity.date.desc()).limit(limit).all(), 'Activity', has_time_in=False)

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
        'Activity': '#A8A8A8'
    }

    mapped = []
    for r in records:
        cid = r.get('client_id')
        client = Client.query.get(cid)
        name = client.full_name if client else f"Client #{cid}"
        dob = client.dob.isoformat() if client and client.dob else None
        date_str = r['date'].isoformat() if r['date'] else (r['datetime'].date().isoformat() if r['datetime'] else None)
        mapped.append({
            'client_id': cid,
            'id': cid,
            'name': name,
            'dob': dob,
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
    query = ClientActivity.query

    if client_id:
        query = query.filter_by(client_id=client_id)
    if activity_id:
        query = query.filter_by(activity_id=activity_id)

    records = query.all()
    data = ClientActivitySchema(many=True).dump(records)
    return jsonify(data), 200

@app.route("/client_activity/<int:id>", methods=["GET"])
def get_client_activity_record(id):
    record = ClientActivity.query.get(id)
    if not record:
        return jsonify({"message": "Client activity record not found"}), 404
    data = ClientActivitySchema().dump(record)
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
    
    for key, value in data.items():
        setattr(activity, key, value)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()  
        return jsonify({"message": "Database error", "error": str(e)}), 500
    
    return jsonify({"message": "Activity updated"}), 200

# update client activity
@app.route("/client_activity/<int:id>", methods=["PUT"])
def update_client_activity(id):
    record = ClientActivity.query.get(id)
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
@app.route("/client_activity/<int:id>", methods=["DELETE"])
def delete_client_activity(id):
    record = ClientActivity.query.get(id)

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

        activity_clients = db.session.query(ClientActivity.client_id).filter(
            ClientActivity.date >= start_date,
            ClientActivity.date <= end_date
        ).distinct().all()
        client_ids.update([c[0] for c in activity_clients])

        total_clients = len(client_ids)

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

        safe_sleep_count = db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(
            SafeSleepRecord.date >= start_date,
            SafeSleepRecord.date <= end_date
        ).scalar() or 0

        # Count activity records (activities attended)
        activity_count = db.session.query(func.count(Activity.activity_id)).filter(
            Activity.date >= start_date,
            Activity.date <= end_date
        ).scalar() or 0

        service_breakdown = {
            'Coat Check': int(coat_check_count),
            'Washroom': int(washroom_count),
            'Sanctuary': int(sanctuary_count),
            'Clinic': int(clinic_count),
            'Safe Sleep': int(safe_sleep_count)
        }
        # include activities in breakdown
        service_breakdown['Activity'] = int(activity_count)

        # total_clients should represent total service usages (sum of all service counts)
        total_clients = int(coat_check_count + washroom_count + sanctuary_count + clinic_count + safe_sleep_count + activity_count)
        
        # Get hourly/daily/monthly data for the chart
        chart_data = []
        
        if time_range == 'day':
            # Group by hour (9am to 6pm) and count service entries (not unique clients)
            for hour in range(9, 19):  # 9am to 6pm
                hour_start = datetime.combine(today, datetime.min.time().replace(hour=hour))
                hour_end = hour_start + timedelta(hours=1)

                hour_total = 0
                hour_total += db.session.query(func.count(WashroomRecord.washroom_id)).filter(
                    WashroomRecord.time_in >= hour_start,
                    WashroomRecord.time_in < hour_end
                ).scalar() or 0
                hour_total += db.session.query(func.count(CoatCheckRecord.check_id)).filter(
                    CoatCheckRecord.time_in >= hour_start,
                    CoatCheckRecord.time_in < hour_end
                ).scalar() or 0
                hour_total += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(
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
                day_total = 0
                day_total += db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(ClinicRecord.clinic_id)).filter(ClinicRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(SafeSleepRecord.date == day_date).scalar() or 0
                # include activity records by date
                day_total += db.session.query(func.count(Activity.activity_id)).filter(Activity.date == day_date).scalar() or 0

                chart_data.append({
                    'label': days[i],
                    'value': int(day_total)
                })
        
        elif time_range == 'month':
            # Group by day, but only show every few days to avoid crowding
            days_in_month = (end_date - start_date).days + 1
            step = max(1, days_in_month // 10)  # Show ~10 data points
            
            for i in range(0, days_in_month, step):
                day_date = start_date + timedelta(days=i)
                day_total = 0
                day_total += db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(ClinicRecord.clinic_id)).filter(ClinicRecord.date == day_date).scalar() or 0
                day_total += db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(SafeSleepRecord.date == day_date).scalar() or 0
                # include activity records for the month grouping
                day_total += db.session.query(func.count(Activity.activity_id)).filter(Activity.date == day_date).scalar() or 0

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

                month_total = 0
                month_total += db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.date >= month_start, WashroomRecord.date <= month_end).scalar() or 0
                month_total += db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.date >= month_start, CoatCheckRecord.date <= month_end).scalar() or 0
                month_total += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.date >= month_start, SanctuaryRecord.date <= month_end).scalar() or 0
                month_total += db.session.query(func.count(ClinicRecord.clinic_id)).filter(ClinicRecord.date >= month_start, ClinicRecord.date <= month_end).scalar() or 0
                month_total += db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(SafeSleepRecord.date >= month_start, SafeSleepRecord.date <= month_end).scalar() or 0
                # include activity records in monthly aggregation
                month_total += db.session.query(func.count(Activity.activity_id)).filter(Activity.date >= month_start, Activity.date <= month_end).scalar() or 0

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
