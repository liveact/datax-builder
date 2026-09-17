from typing import List

from pydantic import BaseModel


class DatasourceInfo(BaseModel):
    name: str
    type: str
    host: str
    port: int


class DatabaseListResponse(BaseModel):
    datasource: str
    databases: List[str]


class TableListResponse(BaseModel):
    datasource: str
    database: str
    tables: List[str]


class TestConnectionResponse(BaseModel):
    ok: bool
    message: str
