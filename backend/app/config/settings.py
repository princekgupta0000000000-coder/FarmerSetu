from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FarmerSetu API"
    # Vercel's filesystem is read-only except /tmp. This is only a development fallback;
    # production data should use PostgreSQL via DATABASE_URL.
    database_url: str = "sqlite:////tmp/farmersetu.db"
    jwt_secret_key: str = "change-this-secret-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
