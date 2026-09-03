import json
import os
from functools import lru_cache

import firebase_admin
from firebase_admin import credentials, auth


@lru_cache(maxsize=1)
def _init_firebase():
    if firebase_admin._apps:
        return firebase_admin.get_app()
    raw = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON')
    if not raw:
        raise RuntimeError('Firebase Admin is not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON to Railway.')
    try:
        info = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.') from exc
    return firebase_admin.initialize_app(credentials.Certificate(info))


def verify_firebase_id_token(id_token: str) -> dict:
    _init_firebase()
    return auth.verify_id_token(id_token, check_revoked=True)
