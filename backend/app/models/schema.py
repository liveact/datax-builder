from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class ColumnSchema(BaseModel):
    name: str
    data_type: str
    column_type: str
    length: Optional[int] = None
    precision: Optional[int] = None
    scale: Optional[int] = None
    nullable: bool
    default_value: Optional[str] = None
    comment: str = ""
    primary_key: bool = False
    auto_increment: bool = False
    extra: str = ""
    column_key: str = ""
    ordinal_position: int


class TableSchema(BaseModel):
    datasource: str
    database: str
    table: str
    columns: List[ColumnSchema]
    table_comment: str = ""
    engine: str = ""
    charset: str = ""
    row_count: int = 0
    data_size: int = 0
