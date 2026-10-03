"""Application configuration, loaded from environment / .env."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # LLM
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-5"
    claude_model_hard: str = "claude-opus-4-8"

    # Integrations
    integrations_mode: str = "stub"  # "stub" | "live"

    # Zoho
    zoho_client_id: str = ""
    zoho_client_secret: str = ""
    zoho_refresh_token: str = ""
    zoho_api_domain: str = "https://www.zohoapis.com"

    # Argus
    argus_base_url: str = ""
    argus_api_key: str = ""

    # Decision routing
    confidence_review_threshold: float = 0.75
    auto_approve_threshold: float = 0.90

    # Database
    database_url: str = "sqlite:///./spark.db"

    @property
    def llm_enabled(self) -> bool:
        return bool(self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
