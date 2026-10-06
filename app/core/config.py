from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    DATABASE_URL: str

    SECRET_KEY: str

    JWT_ALGORITHM: str = "HS256"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    DEBUG: bool = False

    DEVICE_OFFLINE_AFTER_SECONDS: int = 60

    DEVICE_MONITOR_INTERVAL_SECONDS: int = 15

    DEVICE_MONITOR_ENABLED: bool = True

    ALERT_COOLDOWN_SECONDS: int = 300

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True
    )


settings = Settings()
