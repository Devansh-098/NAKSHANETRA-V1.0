from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    # SecretStr keeps the key out of repr()/logs. Optional so the API still boots without it;
    # only reverse geocoding is disabled.
    google_maps_server_api_key: SecretStr | None = None
    frontend_url: str = "http://localhost:5173"
    google_timeout_seconds: float = 8.0

    @property
    def cors_origins(self) -> list[str]:
        """FRONTEND_URL may hold a comma-separated list, e.g. for a preview deploy."""
        return [o.strip().rstrip("/") for o in self.frontend_url.split(",") if o.strip()]

    @property
    def has_google_key(self) -> bool:
        return bool(self.google_maps_server_api_key and self.google_maps_server_api_key.get_secret_value().strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
