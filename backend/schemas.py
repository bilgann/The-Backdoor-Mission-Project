from marshmallow import Schema, fields, validate, validates, ValidationError, EXCLUDE
from datetime import date


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
        if value is None:
            print("Warning: time_out not provided for this record")

    @validates('washroom_type')
    def validate_washroom_type(self, value, **kwargs):
        valid_types = ['A', 'B']
        if value not in valid_types:
            raise ValidationError(f"washroom_type must be one of {valid_types}")


class CoatCheckSchema(Schema):
    check_id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    bin_no = fields.Int(required=True)
    time_in = fields.DateTime(required=True)
    time_out = fields.DateTime(required=False)
    date = fields.Date(required=True)

    @validates("time_out")
    def validate_time_out(self, value, **kwargs):
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
    class Meta:
        unknown = EXCLUDE
    activity_id = fields.Int(dump_only=True)
    activity_name = fields.Str(required=True, validate=validate.Length(min=1))
    date = fields.Date(required=True)
    start_time = fields.DateTime(required=False, allow_none=True)
    end_time = fields.DateTime(required=False, allow_none=True)
    attendance = fields.Int(required=False, load_default=0)
    # color is a frontend-only UI preference and not persisted


class ClientActivitySchema(Schema):
    id = fields.Int(dump_only=True)
    client_id = fields.Int(required=True)
    activity_id = fields.Int(required=True)
    date = fields.Date(required=True)
