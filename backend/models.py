from db import db


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
    date = db.Column(db.DateTime, nullable=False)
    purpose_of_visit = db.Column(db.Text, nullable=True)


class SafeSleepRecord(db.Model):
    __tablename__ = "safe_sleep_records"
    sleep_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    client_id = db.Column(db.Integer, db.ForeignKey('client.client_id'), nullable=False)
    date = db.Column(db.Date, nullable=False)


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
    # attendance kept; color intentionally not stored in DB


class ClientActivity(db.Model):
    __tablename__ = "client_activity"
    client_activity_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    client_id = db.Column(db.Integer, db.ForeignKey('client.client_id'), nullable=False)
    activity_id = db.Column(db.Integer, db.ForeignKey('activity_records.activity_id'), nullable=False)
    date = db.Column(db.DateTime, nullable=False)
