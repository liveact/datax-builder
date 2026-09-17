import re

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.models.schema import ColumnSchema, TableSchema
from app.plugins.base import MetadataAdapter

_SAFE_IDENTIFIER = re.compile(r"^[A-Za-z0-9_$]+$")


def _validate_identifier(name: str, label: str) -> None:
    if not _SAFE_IDENTIFIER.match(name):
        raise ValueError(f"Invalid {label}: {name!r}")

_COLUMNS_QUERY = text("""
SELECT
    COLUMN_NAME, DATA_TYPE, COLUMN_TYPE,
    CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE,
    IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT,
    COLUMN_KEY, EXTRA, ORDINAL_POSITION
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = :database AND TABLE_NAME = :table
ORDER BY ORDINAL_POSITION
""")

_TABLE_INFO_QUERY = text("""
SELECT TABLE_COMMENT, ENGINE, TABLE_COLLATION, TABLE_ROWS, DATA_LENGTH
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = :database AND TABLE_NAME = :table
""")


class MySQLMetadataAdapter(MetadataAdapter):
    def get_table_schema(
        self, engine: Engine, database: str, table: str, exact_count: bool = False
    ) -> TableSchema:
        with engine.connect() as conn:
            column_rows = conn.execute(
                _COLUMNS_QUERY,
                {"database": database, "table": table},
            ).mappings().all()

            table_info = conn.execute(
                _TABLE_INFO_QUERY,
                {"database": database, "table": table},
            ).mappings().first()

        columns = [
            ColumnSchema(
                name=row["COLUMN_NAME"],
                data_type=row["DATA_TYPE"],
                column_type=row["COLUMN_TYPE"],
                length=row["CHARACTER_MAXIMUM_LENGTH"],
                precision=row["NUMERIC_PRECISION"],
                scale=row["NUMERIC_SCALE"],
                nullable=row["IS_NULLABLE"] == "YES",
                default_value=row["COLUMN_DEFAULT"],
                comment=row["COLUMN_COMMENT"] or "",
                primary_key=row["COLUMN_KEY"] == "PRI",
                auto_increment="auto_increment" in (row["EXTRA"] or "").lower(),
                extra=row["EXTRA"] or "",
                column_key=row["COLUMN_KEY"] or "",
                ordinal_position=row["ORDINAL_POSITION"],
            )
            for row in column_rows
        ]

        table_comment = ""
        engine_name = ""
        charset = ""
        row_count = 0
        data_size = 0
        if table_info:
            table_comment = table_info["TABLE_COMMENT"] or ""
            engine_name = table_info["ENGINE"] or ""
            collation = table_info["TABLE_COLLATION"] or ""
            charset = collation.split("_")[0] if collation else ""
            row_count = int(table_info["TABLE_ROWS"] or 0)
            data_size = int(table_info["DATA_LENGTH"] or 0)

        if exact_count:
            _validate_identifier(database, "database name")
            _validate_identifier(table, "table name")
            with engine.connect() as conn2:
                count_result = conn2.execute(
                    text(f"SELECT COUNT(*) FROM `{database}`.`{table}`")
                )
                row_count = count_result.scalar() or 0

        return TableSchema(
            datasource="",
            database=database,
            table=table,
            columns=columns,
            table_comment=table_comment,
            engine=engine_name,
            charset=charset,
            row_count=row_count,
            data_size=data_size,
        )
