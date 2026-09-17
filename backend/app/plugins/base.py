from abc import ABC, abstractmethod

from sqlalchemy.engine import Engine

from app.models.schema import TableSchema


class MetadataAdapter(ABC):
    @abstractmethod
    def get_table_schema(self, engine: Engine, database: str, table: str, *, exact_count: bool = False) -> TableSchema:
        pass
