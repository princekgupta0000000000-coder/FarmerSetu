from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest
from app.utils.security import create_access_token, hash_password, verify_password


class AuthError(Exception):
    pass


def register_farmer(db: Session, data: RegisterRequest) -> User:
    existing = db.scalar(select(User).where(or_(User.mobile == data.mobile, User.email == data.email if data.email else False)))
    if existing:
        if existing.mobile == data.mobile:
            raise AuthError("A farmer with this mobile number already exists")
        raise AuthError("An account with this email already exists")

    user = User(
        full_name=data.full_name.strip(),
        mobile=data.mobile,
        email=str(data.email).lower() if data.email else None,
        password_hash=hash_password(data.password),
        state=data.state.strip(),
        district=data.district.strip(),
        role="farmer",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login_farmer(db: Session, data: LoginRequest) -> tuple[User, str]:
    identifier = data.identifier.strip()
    query = select(User).where(or_(User.mobile == identifier, User.email == identifier.lower()))
    user = db.scalar(query)
    if not user or not verify_password(data.password, user.password_hash):
        raise AuthError("Invalid mobile/email or password")
    if not user.is_active:
        raise AuthError("This account is inactive")
    return user, create_access_token(str(user.id), user.role)
