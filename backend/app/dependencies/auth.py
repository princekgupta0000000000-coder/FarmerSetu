from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.user import User
from app.utils.security import decode_access_token

# Declaring HTTPBearer here makes FastAPI expose a real Bearer security scheme
# in OpenAPI/Swagger, so the Authorize button can be used once for all protected APIs.
bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token returned by /api/auth/login")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    subject = payload.get("sub")
    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Never trust the role from the client. The role used by application
    # authorization comes from the current database record.
    return user


def require_farmer(user: User = Depends(get_current_user)) -> User:
    if user.role != "farmer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Farmer access required")
    return user


def require_employee(user: User = Depends(get_current_user)) -> User:
    if user.role not in {"employee", "procurement_employee", "officer", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employee access required")
    return user
