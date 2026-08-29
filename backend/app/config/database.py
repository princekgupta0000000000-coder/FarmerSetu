from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config.settings import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _ensure_tables():
    # Import models before create_all so SQLAlchemy knows their tables.
    from app.models.user import User  # noqa: F401
    Base.metadata.create_all(bind=engine)


def get_db():
    # Vercel serverless instances may start without a persistent filesystem.
    # For the current SQLite fallback, create the schema on first API use.
    _ensure_tables()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
