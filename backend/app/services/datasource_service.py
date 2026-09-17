from __future__ import annotations

import logging
import threading
from typing import Dict, List, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.engine import URL

from app.core.config import DatasourceConfig, get_datasource_by_name

logger = logging.getLogger(__name__)

SYSTEM_DATABASES = frozenset(
    {"information_schema", "mysql", "performance_schema", "sys"}
)


def get_datasource_config(name: str) -> DatasourceConfig:
    return get_datasource_by_name(name)


def _build_connection_url(datasource: DatasourceConfig, database: Optional[str] = None) -> URL:
    db = database or datasource.database
    return URL.create(
        drivername="mysql+pymysql",
        username=datasource.username,
        password=datasource.password,
        host=datasource.host,
        port=datasource.port,
        database=db,
    )


_engine_cache: Dict[str, Engine] = {}
_engine_lock = threading.Lock()


def get_connection(datasource_name: str, database: Optional[str] = None) -> Engine:
    datasource = get_datasource_config(datasource_name)
    cache_key = f"{datasource_name}:{database or datasource.database}"
    with _engine_lock:
        if cache_key not in _engine_cache:
            _engine_cache[cache_key] = create_engine(
                _build_connection_url(datasource, database),
                pool_pre_ping=True,
                connect_args={"connect_timeout": 5},
            )
        return _engine_cache[cache_key]


def dispose_all_engines() -> None:
    with _engine_lock:
        for engine in _engine_cache.values():
            engine.dispose()
        _engine_cache.clear()


def test_connection(name: str, database: Optional[str] = None) -> dict:
    try:
        engine = get_connection(name, database)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"ok": True, "message": "连接成功"}
    except Exception as exc:
        logger.error("Connection test failed for %s: %s", name, exc, exc_info=True)
        return {"ok": False, "message": "连接失败，请检查数据源配置"}


def list_databases(datasource_name: str) -> List[str]:
    engine = get_connection(datasource_name)
    with engine.connect() as conn:
        result = conn.execute(text("SHOW DATABASES"))
        databases = [row[0] for row in result]
    return [db for db in databases if db not in SYSTEM_DATABASES]


def list_tables(datasource_name: str, database: str) -> List[str]:
    engine = get_connection(datasource_name, database)
    with engine.connect() as conn:
        result = conn.execute(text("SHOW TABLES"))
        tables = [row[0] for row in result]
    return tables


def check_strict_mode(datasource_name: str, database: Optional[str] = None) -> bool:
    engine = get_connection(datasource_name, database)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT @@sql_mode"))
        sql_mode = result.scalar() or ""
    return "STRICT_TRANS_TABLES" in sql_mode or "STRICT_ALL_TABLES" in sql_mode


_FK_REFERENCES_QUERY = text("""
    SELECT
        kcu.TABLE_NAME AS child_table,
        kcu.COLUMN_NAME AS child_column,
        kcu.REFERENCED_COLUMN_NAME AS parent_column,
        rc.CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE kcu
    JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
        AND kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    WHERE kcu.REFERENCED_TABLE_SCHEMA = :database
        AND kcu.REFERENCED_TABLE_NAME = :table
""")

_FK_DEPENDENCIES_QUERY = text("""
    SELECT
        kcu.REFERENCED_TABLE_NAME AS parent_table,
        kcu.COLUMN_NAME AS child_column,
        kcu.REFERENCED_COLUMN_NAME AS parent_column,
        rc.CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE kcu
    JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
        AND kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    WHERE kcu.TABLE_SCHEMA = :database
        AND kcu.TABLE_NAME = :table
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
""")


def get_fk_references(datasource_name: str, database: str, table: str) -> List[dict]:
    """Get child tables that reference this table via foreign key."""
    engine = get_connection(datasource_name, database)
    with engine.connect() as conn:
        rows = conn.execute(
            _FK_REFERENCES_QUERY, {"database": database, "table": table}
        ).mappings().all()
    return [dict(r) for r in rows]


def get_fk_dependencies(datasource_name: str, database: str, table: str) -> List[dict]:
    """Get parent tables that this table depends on via foreign key."""
    engine = get_connection(datasource_name, database)
    with engine.connect() as conn:
        rows = conn.execute(
            _FK_DEPENDENCIES_QUERY, {"database": database, "table": table}
        ).mappings().all()
    return [dict(r) for r in rows]
