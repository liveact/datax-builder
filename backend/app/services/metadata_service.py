from app.core.exceptions import SchemaError
from app.models.schema import TableSchema
from app.plugins.mysql.metadata import MySQLMetadataAdapter
from app.services.datasource_service import get_connection, get_datasource_config


def get_table_schema(
    datasource_name: str, database: str, table: str, exact_count: bool = False
) -> TableSchema:
    datasource = get_datasource_config(datasource_name)
    if datasource.type != "mysql":
        raise SchemaError(f"Unsupported datasource type: {datasource.type}")

    engine = get_connection(datasource_name, database)
    adapter = MySQLMetadataAdapter()
    schema = adapter.get_table_schema(engine, database, table, exact_count=exact_count)

    if not schema.columns:
        raise SchemaError(f"Table '{table}' not found in database '{database}'")

    return schema.model_copy(update={"datasource": datasource_name})
