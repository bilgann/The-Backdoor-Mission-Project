from sqlalchemy import text


def fix_schema_constraints(app, db):
    """Attempt to remove accidental unique constraints/indexes created by migrations.
    This is a best-effort operation and will not raise on failure.
    """
    try:
        with app.app_context():
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
        print('Warning: could not verify or modify washroom_records constraints')
