from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.auth import router as auth_router

app = FastAPI(title="FarmerSetu API", version="1.0.0")

# Allow the deployed Next.js frontend and local development.
# Do not combine wildcard origins with credentials in browser requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://farmer-setu.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


@app.get("/")
def root():
    return {"message": "FarmerSetu API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
