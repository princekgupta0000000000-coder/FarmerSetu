from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config.settings import settings

connect_args = {'check_same_thread': False} if settings.database_url.startswith('sqlite') else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _ensure_tables():
    from app.models.user import User  # noqa: F401
    from app.models.booking import Booking  # noqa: F401
    Base.metadata.create_all(bind=engine)

    # create_all() does not add columns to an existing table. These fields are
    # required by the employee quality/payment workflow, so add them safely for
    # existing SQLite/Postgres databases as well.
    try:
        inspector = inspect(engine)
        columns = {c['name'] for c in inspector.get_columns('bookings')}
        additions = {
            'quality_status': "VARCHAR(30) DEFAULT 'Pending'",
            'quality_note': "VARCHAR(500) DEFAULT ''",
            'payment_status': "VARCHAR(30) DEFAULT 'Pending'",
            'payment_reference': "VARCHAR(100) DEFAULT ''",
            'received_quantity': 'FLOAT',
        }
        missing = {name: definition for name, definition in additions.items() if name not in columns}
        if missing:
            with engine.begin() as conn:
                for name, definition in missing.items():
                    conn.execute(text(f'ALTER TABLE bookings ADD COLUMN {name} {definition}'))
    except Exception:
        # Do not prevent the API from starting because a migration was already
        # applied by another process. Normal database errors still surface when
        # an endpoint actually uses the affected fields.
        pass


def get_db():
    _ensure_tables()
    db=SessionLocal()
    try: yield db
    finally: db.close()
