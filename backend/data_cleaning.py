from app import db, Client, WashroomRecord, CoatCheckRecord, SafeSleepRecord, ClientActivity, ClinicRecord, Activity, SanctuaryRecord
from sqlalchemy import func

def standardize_client_names():
    """
    Cleans and standardizes client names (trims spaces, converts to title case).
    """
    clients = Client.query.all()
    count = 0
    for client in clients:
        clean_name = client.full_name.strip().title()
        if client.full_name != clean_name:
            client.full_name = clean_name
            count += 1
    db.session.commit()
    print(f"{count} client names standardized.")
    
def remove_duplicate_clients():
    """
    Removes duplicate client entries with same name and DOB.
    Keeps the first entry and deletes the rest.
    """
    duplicates = (
        db.session.query(Client.full_name, Client.dob, func.count(Client.client_id))
        .group_by(Client.full_name, Client.dob)
        .having(func.count(Client.client_id) > 1)
        .all()
    )

    removed = 0
    for name, dob, count in duplicates:
        duplicates_to_delete = (
            Client.query.filter_by(full_name=name, dob=dob)
            .order_by(Client.client_id.asc())
            .offset(1)  # skip first record
            .all()
        )
        for dup in duplicates_to_delete:
            db.session.delete(dup)
            removed += 1

    db.session.commit()
    print(f"{removed} duplicate clients removed.")