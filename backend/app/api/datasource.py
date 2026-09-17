import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core.config import get_config
from app.core.exceptions import SchemaError
from app.core.security import get_current_user
from app.models.datasource import (
    DatabaseListResponse,
    DatasourceInfo,
    TableListResponse,
    TestConnectionResponse,
)
from app.services import datasource_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/datasources", tags=["datasource"])


from typing import List as _List

@router.get("", response_model=_List[DatasourceInfo])
def list_datasources(
    _current_user: str = Depends(get_current_user),
) -> _List[DatasourceInfo]:
    config = get_config()
    return [
        DatasourceInfo(name=ds.name, type=ds.type, host=ds.host, port=ds.port)
        for ds in config.datasources
    ]


@router.get("/{datasource}/test", response_model=TestConnectionResponse)
def test_connection(
    datasource: str,
    database: Optional[str] = Query(None),
    _current_user: str = Depends(get_current_user),
) -> TestConnectionResponse:
    result = datasource_service.test_connection(datasource, database=database)
    return TestConnectionResponse(ok=result["ok"], message=result["message"])


@router.get("/{datasource}/databases", response_model=DatabaseListResponse)
def list_databases(
    datasource: str,
    _current_user: str = Depends(get_current_user),
) -> DatabaseListResponse:
    try:
        databases = datasource_service.list_databases(datasource)
    except Exception as exc:
        logger.error("Failed to list databases for %s: %s", datasource, exc, exc_info=True)
        raise SchemaError("获取数据库列表失败") from exc
    return DatabaseListResponse(datasource=datasource, databases=databases)


@router.get(
    "/{datasource}/databases/{database}/tables",
    response_model=TableListResponse,
)
def list_tables(
    datasource: str,
    database: str,
    _current_user: str = Depends(get_current_user),
) -> TableListResponse:
    try:
        tables = datasource_service.list_tables(datasource, database)
    except Exception as exc:
        logger.error("Failed to list tables for %s.%s: %s", datasource, database, exc, exc_info=True)
        raise SchemaError("获取表列表失败") from exc
    return TableListResponse(
        datasource=datasource,
        database=database,
        tables=tables,
    )
