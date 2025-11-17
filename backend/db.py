from sqlalchemy.orm import DeclarativeBase
from flask_sqlalchemy import SQLAlchemy


class Base(DeclarativeBase):
    pass


# shared SQLAlchemy instance used across modules
db = SQLAlchemy(model_class=Base)
