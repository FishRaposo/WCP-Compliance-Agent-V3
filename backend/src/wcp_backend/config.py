from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://wcp:wcp@localhost:5432/wcp"
    redis_url: str = "redis://localhost:6379"
    elasticsearch_url: str = "http://localhost:9200"
    celery_broker_url: str = "redis://localhost:6379/0"
    phoenix_collector_endpoint: str = "http://localhost:6006"

    openai_api_key: str = ""
    sam_gov_api_key: str = ""

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    log_level: str = "INFO"
    environment: str = "development"

    trust_score_human_review_threshold: float = 0.60
    trust_score_high_band: float = 0.85
    trust_score_medium_band: float = 0.60


settings = Settings()
