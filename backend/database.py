import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_SQLITE_URL = f"sqlite:///{(BASE_DIR / 'invenia_ai.db').as_posix()}"


def resolve_database_url() -> str:
    return (
        os.getenv("DATABASE_URL")
        or os.getenv("RAILWAY_DATABASE_URL")
        or DEFAULT_SQLITE_URL
    )


DATABASE_URL = resolve_database_url()
engine_kwargs = {"pool_pre_ping": True}

if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

try:
    engine = create_engine(DATABASE_URL, **engine_kwargs)
except Exception as exc:
    print(f"Database connection error for '{DATABASE_URL}': {exc}")
    engine = create_engine(
        DEFAULT_SQLITE_URL,
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
