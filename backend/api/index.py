import os
import sys

# Vercel executes this file from /api. Ensure the sibling backend/app package
# is importable in the serverless runtime.
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.main import app  # noqa: E402
