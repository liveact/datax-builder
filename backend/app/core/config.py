from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from pydantic import BaseModel, Field

from app.core.exceptions import DatasourceNotFoundError


class UserConfig(BaseModel):
    password_hash: str


class DatasourceConfig(BaseModel):
    name: str
    type: str = "mysql"
    host: str
    port: int = 3306
    username: str
    password: str
    database: str = ""


class ServerConfig(BaseModel):
    jwt_secret: Optional[str] = None
    cors_origins: str = "*"
    dev_mode: bool = True


class AppConfig(BaseModel):
    users: Dict[str, UserConfig]
    datasources: List[DatasourceConfig] = Field(default_factory=list)
    server: ServerConfig = Field(default_factory=ServerConfig)


def _resolve_config_path() -> Path:
    backend_dir = Path(__file__).resolve().parent.parent.parent
    local_path = backend_dir.parent / "config.yaml"
    docker_path = Path("/app/config.yaml")

    if local_path.is_file():
        return local_path
    if docker_path.is_file():
        return docker_path

    raise FileNotFoundError(
        f"Config file not found at {local_path} or {docker_path}"
    )


def _load_config_from_file() -> AppConfig:
    config_path = _resolve_config_path()
    with config_path.open(encoding="utf-8") as config_file:
        raw_config: Dict[str, Any] = yaml.safe_load(config_file)
    return AppConfig.model_validate(raw_config)


@lru_cache
def get_config() -> AppConfig:
    return _load_config_from_file()


def get_datasource_by_name(name: str) -> DatasourceConfig:
    config = get_config()
    for datasource in config.datasources:
        if datasource.name == name:
            return datasource
    raise DatasourceNotFoundError(name)
