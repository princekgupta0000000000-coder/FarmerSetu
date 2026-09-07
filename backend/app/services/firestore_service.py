import json
import os
from functools import lru_cache
from typing import Any, Optional

import firebase_admin
from firebase_admin import credentials, firestore


@lru_cache(maxsize=1)
def get_firebase_app():
    if firebase_admin._apps:
        return firebase_admin.get_app()

    raw = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if not raw:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.")

    try:
        service_account = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON contains invalid JSON.") from exc

    return firebase_admin.initialize_app(credentials.Certificate(service_account))


@lru_cache(maxsize=1)
def get_firestore_client():
    get_firebase_app()
    return firestore.client()


def collection(name: str):
    return get_firestore_client().collection(name)


def get_document(collection_name: str, document_id: str) -> Optional[dict]:
    snapshot = collection(collection_name).document(str(document_id)).get()
    if not snapshot.exists:
        return None
    data = snapshot.to_dict() or {}
    data["_id"] = snapshot.id
    return data


def set_document(collection_name: str, document_id: str, data: dict[str, Any], merge: bool = True) -> dict[str, Any]:
    collection(collection_name).document(str(document_id)).set(data, merge=merge)
    return {"_id": str(document_id), **data}


def update_document(collection_name: str, document_id: str, data: dict[str, Any]) -> None:
    collection(collection_name).document(str(document_id)).update(data)


def delete_document(collection_name: str, document_id: str) -> None:
    collection(collection_name).document(str(document_id)).delete()
