import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.security import get_current_user
from app.models.schema import TableSchema
from app.services import datasource_service, metadata_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["schema"])


class StrictModeResponse(BaseModel):
    strict: Optional[bool] = None


class FkInfoResponse(BaseModel):
    referenced_by: Optional[List[str]] = None
    depends_on: Optional[List[str]] = None


@router.get(
    "/datasources/{datasource}/databases/{database}/tables/{table}/schema",
    response_model=TableSchema,
)
def get_table_schema(
    datasource: str,
    database: str,
    table: str,
    exact_count: bool = Query(False),
    _current_user: str = Depends(get_current_user),
) -> TableSchema:
    return metadata_service.get_table_schema(datasource, database, table, exact_count=exact_count)


@router.get(
    "/datasources/{datasource}/databases/{database}/strict",
    response_model=StrictModeResponse,
)
def get_strict_mode(
    datasource: str,
    database: str,
    _current_user: str = Depends(get_current_user),
) -> StrictModeResponse:
    try:
        strict = datasource_service.check_strict_mode(datasource, database)
    except Exception:
        logger.warning("Failed to check STRICT mode for %s.%s", datasource, database, exc_info=True)
        strict = None
    return StrictModeResponse(strict=strict)


@router.get(
    "/datasources/{datasource}/databases/{database}/tables/{table}/fk",
    response_model=FkInfoResponse,
)
def get_fk_info(
    datasource: str,
    database: str,
    table: str,
    _current_user: str = Depends(get_current_user),
) -> FkInfoResponse:
    referenced_by: Optional[List[str]] = None
    depends_on: Optional[List[str]] = None
    try:
        fk_refs = datasource_service.get_fk_references(datasource, database, table)
        referenced_by = sorted({r["child_table"] for r in fk_refs}) if fk_refs else []
    except Exception:
        logger.warning("Failed to query FK references for %s.%s", database, table, exc_info=True)
    try:
        fk_deps = datasource_service.get_fk_dependencies(datasource, database, table)
        depends_on = sorted({r["parent_table"] for r in fk_deps}) if fk_deps else []
    except Exception:
        logger.warning("Failed to query FK dependencies for %s.%s", database, table, exc_info=True)
    return FkInfoResponse(referenced_by=referenced_by, depends_on=depends_on)
