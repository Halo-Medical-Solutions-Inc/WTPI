from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str
    REDIS_URL: str

    SECRET_KEY: str
    MASTER_KEYS: str
    CURRENT_MASTER_KID: str

    TWILIO_ACCOUNT_SID: str
    TWILIO_AUTH_TOKEN: str
    TWILIO_PHONE_NUMBER: str

    VAPI_API_KEY: str
    VAPI_ASSISTANT_ID: str

    SMTP_EMAIL: str
    SMTP_PASSWORD: str
    FROM_NAME: str = "West Texas Pain Institute"

    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: str = "http://localhost:3000"

    SESSION_EXPIRY_DAYS: int = 7
    INVITATION_EXPIRY_HOURS: int = 48
    PASSWORD_RESET_EXPIRY_HOURS: int = 1
    PASSWORD_RESET_MAX_REQUESTS: int = 3

    CLAUDE_API_KEY: str = ""
    CLAUDE_EXTRACTION_MODEL: str = "claude-opus-4-5-20251101"

    SLACK_BOT_TOKEN: str = ""
    SLACK_SUPPORT_CHANNEL_ID: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def master_keys_list(self) -> List[str]:
        return [k.strip() for k in self.MASTER_KEYS.split(",")]


settings = Settings()
