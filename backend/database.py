from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://budget:budget@db:5432/budget"
)

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)


def get_db():
    db = Session()
    try:
        yield db
    finally:
        db.close()
