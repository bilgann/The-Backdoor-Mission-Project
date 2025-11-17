import io
import os
import pandas as pd
from flask import request, jsonify, send_file
from marshmallow import ValidationError
from sqlalchemy import func
from datetime import datetime, timedelta

from db import db
from models import (
    Client, WashroomRecord, CoatCheckRecord, SanctuaryRecord,
    ClinicRecord, SafeSleepRecord, Activity, ClientActivity
)
from schemas import (
    ClientSchema, WashroomSchema, CoatCheckSchema, SanctuarySchema,
    ClinicSchema, SafeSleepSchema, ActivitySchema, ClientActivitySchema
)

def register_routes(app):
    # Keep route registrations in this function to avoid import-time app circulars

    @app.route("/data_clean/client", methods=["POST"])
    def clean_clients():
        clients = Client.query.all()
        standardized = 0
        for client in clients:
            clean_name = client.full_name.strip().title()
            if client.full_name != clean_name:
                client.full_name = clean_name
                standardized += 1

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

    @app.route("/export/<string:table_name>", methods=["GET"])
    def export_table(table_name):
        models_map = {
            "client": Client,
            "washroom_records": WashroomRecord,
            "coat_check_records": CoatCheckRecord,
            "sanctuary_records": SanctuaryRecord,
            "safe_sleep_records": SafeSleepRecord,
            "clinic_records": ClinicRecord,
            "activity_records": Activity,
            "client_activity": ClientActivity
        }
        if table_name not in models_map:
            return jsonify({"message": "Table not found"}), 404
        model = models_map[table_name]
        query = model.query.all()
        if not query:
            return jsonify({"message": "No data found in the table"}), 404
        try:
            df = pd.DataFrame([row.__dict__ for row in query])
            df.drop(columns=["_sa_instance_state"], inplace=True, errors='ignore')
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                df.to_excel(writer, index=False, sheet_name=table_name[:31])
            output.seek(0)
            return send_file(output, as_attachment=True, download_name=f"{table_name}.xlsx",
                             mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        except Exception as e:
            return jsonify({"message": "Error exporting table", "error": str(e)}), 500

    # POST create endpoints (examples: client, washroom, coat_check...)
    @app.route("/client", methods=["POST"]) 
    def create_client():
        payload = request.json
        try:
            data = ClientSchema().load(payload)
        except ValidationError as err:
            return jsonify({"errors": err.messages}), 400
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
        if data.get("time_out") is not None and data["time_out"] <= data["time_in"]:
            return jsonify({"message": "time_out must be after time_in"}), 400
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
        if data.get("time_out") is not None and data["time_out"] <= data["time_in"]:
            return jsonify({"message": "time_out must be after time_in"}), 400
        if data.get("bin_no") is not None and (data["bin_no"] < 1 or data["bin_no"] > 100):
            return jsonify({"message": "bin_no must be between 1 and 100"}), 400
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
        if data.get("time_out") is not None and data["time_out"] <= data["time_in"]:
            return jsonify({"message": "time_out must be after time_in"}), 400
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
        if data["date"] > datetime.now().date():
            return jsonify({"message": "date cannot be in the future"}), 400
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
        client = Client.query.get(data["client_id"])
        if not client:
            return jsonify({"message": "Client not found"}), 404
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

    # GET endpoints (examples and stats)
    @app.route('/api/clients', methods=['GET'])
    def api_get_clients():
        query_param = request.args.get('query')
        q = Client.query
        if query_param:
            q = q.filter(Client.full_name.ilike(f"%{query_param}%"))
        clients = q.limit(200).all()
        data = ClientSchema(many=True).dump(clients)
        return jsonify(data), 200

    @app.route('/api/clients/recent', methods=['GET'])
    def api_recent_clients():
        try:
            limit = int(request.args.get('limit', 10))
        except Exception:
            limit = 10
        records = []
        def push_records(queryset, service_name, has_time_in=False):
            for r in queryset:
                rec_dt = None
                if has_time_in and hasattr(r, 'time_in') and r.time_in is not None:
                    rec_dt = r.time_in
                elif hasattr(r, 'date') and r.date is not None:
                    rec_dt = datetime.combine(r.date, datetime.min.time())
                records.append({'client_id': r.client_id, 'datetime': rec_dt, 'date': getattr(r, 'date', None), 'service': service_name})

        push_records(CoatCheckRecord.query.order_by(CoatCheckRecord.date.desc()).limit(limit).all(), 'Coat Check', has_time_in=True)
        push_records(WashroomRecord.query.order_by(WashroomRecord.date.desc()).limit(limit).all(), 'Washroom', has_time_in=True)
        push_records(SanctuaryRecord.query.order_by(SanctuaryRecord.date.desc()).limit(limit).all(), 'Sanctuary', has_time_in=True)
        push_records(ClinicRecord.query.order_by(ClinicRecord.date.desc()).limit(limit).all(), 'Clinic', has_time_in=False)
        push_records(SafeSleepRecord.query.order_by(SafeSleepRecord.date.desc()).limit(limit).all(), 'Safe Sleep', has_time_in=False)
        push_records(ClientActivity.query.order_by(ClientActivity.date.desc()).limit(limit).all(), 'Activity', has_time_in=False)

        for r in records:
            if r['datetime'] is None:
                r['datetime'] = datetime.min
        records.sort(key=lambda x: x['datetime'], reverse=True)

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
            if request.args.get('debug') == '1':
                return jsonify({'raw_records': mapped, 'recent_clients': recent_clients}), 200
            return jsonify(recent_clients), 200

        result = mapped[:limit]
        if request.args.get('debug') == '1':
            return jsonify({'raw_records': mapped, 'recent_clients': result}), 200
        return jsonify(result), 200

    # Statistics endpoint (fixed to return both unique clients and visitor totals)
    @app.route('/api/client-statistics', methods=['GET'])
    def get_client_statistics():
        try:
            time_range = request.args.get('range', 'day')
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

            # gather distinct client ids across service tables
            client_ids = set()
            for q in [WashroomRecord, CoatCheckRecord, SanctuaryRecord, ClinicRecord, SafeSleepRecord, ClientActivity]:
                rows = db.session.query(q.client_id).filter(q.date >= start_date, q.date <= end_date).distinct().all()
                client_ids.update([r[0] for r in rows])
            total_unique_clients = len(client_ids)

            # counts per service (entries)
            coat_check_count = db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.date >= start_date, CoatCheckRecord.date <= end_date).scalar() or 0
            washroom_count = db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.date >= start_date, WashroomRecord.date <= end_date).scalar() or 0
            sanctuary_count = db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.date >= start_date, SanctuaryRecord.date <= end_date).scalar() or 0
            clinic_count = db.session.query(func.count(ClinicRecord.clinic_id)).filter(ClinicRecord.date >= start_date, ClinicRecord.date <= end_date).scalar() or 0
            safe_sleep_count = db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(SafeSleepRecord.date >= start_date, SafeSleepRecord.date <= end_date).scalar() or 0
            activity_count = db.session.query(func.count(Activity.activity_id)).filter(Activity.date >= start_date, Activity.date <= end_date).scalar() or 0

            service_breakdown = {
                'Coat Check': int(coat_check_count),
                'Washroom': int(washroom_count),
                'Sanctuary': int(sanctuary_count),
                'Clinic': int(clinic_count),
                'Safe Sleep': int(safe_sleep_count),
                'Activity': int(activity_count)
            }

            total_visitors = int(coat_check_count + washroom_count + sanctuary_count + clinic_count + safe_sleep_count + activity_count)

            # prepare chart_data
            chart_data = []
            if time_range == 'day':
                for hour in range(9, 19):
                    hour_start = datetime.combine(today, datetime.min.time().replace(hour=hour))
                    hour_end = hour_start + timedelta(hours=1)
                    hour_total = 0
                    hour_total += db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.time_in >= hour_start, WashroomRecord.time_in < hour_end).scalar() or 0
                    hour_total += db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.time_in >= hour_start, CoatCheckRecord.time_in < hour_end).scalar() or 0
                    hour_total += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.time_in >= hour_start, SanctuaryRecord.time_in < hour_end).scalar() or 0
                    label = f"{hour}am" if hour < 12 else ("12pm" if hour == 12 else f"{hour-12}pm")
                    chart_data.append({'label': label, 'value': int(hour_total)})
            elif time_range == 'week':
                days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
                for i in range(7):
                    day_date = start_date + timedelta(days=i)
                    day_total = 0
                    day_total += db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.date == day_date).scalar() or 0
                    day_total += db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.date == day_date).scalar() or 0
                    day_total += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.date == day_date).scalar() or 0
                    day_total += db.session.query(func.count(ClinicRecord.clinic_id)).filter(ClinicRecord.date == day_date).scalar() or 0
                    day_total += db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(SafeSleepRecord.date == day_date).scalar() or 0
                    day_total += db.session.query(func.count(Activity.activity_id)).filter(Activity.date == day_date).scalar() or 0
                    chart_data.append({'label': days[i], 'value': int(day_total)})
            elif time_range == 'month':
                days_in_month = (end_date - start_date).days + 1
                step = max(1, days_in_month // 10)
                for i in range(0, days_in_month, step):
                    day_date = start_date + timedelta(days=i)
                    day_total = 0
                    day_total += db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.date == day_date).scalar() or 0
                    day_total += db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.date == day_date).scalar() or 0
                    day_total += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.date == day_date).scalar() or 0
                    day_total += db.session.query(func.count(ClinicRecord.clinic_id)).filter(ClinicRecord.date == day_date).scalar() or 0
                    day_total += db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(SafeSleepRecord.date == day_date).scalar() or 0
                    day_total += db.session.query(func.count(Activity.activity_id)).filter(Activity.date == day_date).scalar() or 0
                    chart_data.append({'label': day_date.strftime('%d'), 'value': int(day_total)})
            elif time_range == 'year':
                months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                for month in range(1,13):
                    month_start = today.replace(month=month, day=1)
                    if month == 12:
                        month_end = today.replace(month=12, day=31)
                    else:
                        month_end = (today.replace(month=month+1, day=1) - timedelta(days=1))
                    month_total = 0
                    month_total += db.session.query(func.count(WashroomRecord.washroom_id)).filter(WashroomRecord.date >= month_start, WashroomRecord.date <= month_end).scalar() or 0
                    month_total += db.session.query(func.count(CoatCheckRecord.check_id)).filter(CoatCheckRecord.date >= month_start, CoatCheckRecord.date <= month_end).scalar() or 0
                    month_total += db.session.query(func.count(SanctuaryRecord.sanctuary_id)).filter(SanctuaryRecord.date >= month_start, SanctuaryRecord.date <= month_end).scalar() or 0
                    month_total += db.session.query(func.count(ClinicRecord.clinic_id)).filter(ClinicRecord.date >= month_start, ClinicRecord.date <= month_end).scalar() or 0
                    month_total += db.session.query(func.count(SafeSleepRecord.sleep_id)).filter(SafeSleepRecord.date >= month_start, SafeSleepRecord.date <= month_end).scalar() or 0
                    month_total += db.session.query(func.count(Activity.activity_id)).filter(Activity.date >= month_start, Activity.date <= month_end).scalar() or 0
                    chart_data.append({'label': months[month-1], 'value': int(month_total)})

            return jsonify({'success': True, 'total_clients': int(total_unique_clients), 'total_visitors': int(total_visitors), 'service_breakdown': service_breakdown, 'chart_data': chart_data}), 200
        except Exception as e:
            return jsonify({'success': False, 'message': 'Error fetching statistics', 'error': str(e)}), 500

    # Authentication simplified
    @app.route('/api/login', methods=['POST', 'OPTIONS'])
    def login():
        if request.method == 'OPTIONS':
            response = jsonify({})
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
            response.headers.add('Access-Control-Allow-Methods', 'POST')
            return response
        try:
            data = request.get_json()
            if not data:
                return jsonify({"success": False, "message": "No data provided"}), 400
            username = data.get('username')
            password = data.get('password')
            if username == 'adminuser' and password == 'Admin2025!':
                return jsonify({"success": True, "message": "Login successful"}), 200
            else:
                return jsonify({"success": False, "message": "Invalid username or password"}), 401
        except Exception as e:
            return jsonify({"success": False, "message": "An error occurred during login", "error": str(e)}), 500
