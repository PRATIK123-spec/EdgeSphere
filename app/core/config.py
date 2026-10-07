from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    DATABASE_URL: str

    SECRET_KEY: str

    JWT_ALGORITHM: str = "HS256"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    DEBUG: bool = False

    # Log every SQL statement with its bound parameters. Never enable in
    # production: parameters include password hashes and other sensitive data.
    SQL_ECHO: bool = False

    DEVICE_OFFLINE_AFTER_SECONDS: int = 60

    DEVICE_MONITOR_INTERVAL_SECONDS: int = 15

    DEVICE_MONITOR_ENABLED: bool = True

    ALERT_COOLDOWN_SECONDS: int = 300

    # Comma-separated list of browser origins allowed to call the API,
    # e.g. "https://app.example.com,http://localhost:5173".
    # Empty (default) = no CORS headers: only same-origin / proxied access.
    CORS_ORIGINS: str = ""

    # WebSocket: seconds a client has to send its auth message after
    # connecting, and the interval between server heartbeats.
    WS_AUTH_TIMEOUT_SECONDS: float = 10.0

    WS_HEARTBEAT_SECONDS: float = 30.0

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
