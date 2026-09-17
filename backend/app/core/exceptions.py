from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AuthenticationError(Exception):
    def __init__(self, message: str = "Authentication failed") -> None:
        self.message = message
        super().__init__(message)


class DatasourceNotFoundError(Exception):
    def __init__(self, datasource_id: str) -> None:
        self.datasource_id = datasource_id
        self.message = f"Datasource '{datasource_id}' not found"
        super().__init__(self.message)


class SchemaError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)



def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AuthenticationError)
    async def authentication_error_handler(
        _request: Request,
        exc: AuthenticationError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=401,
            content={"detail": exc.message},
        )

    @app.exception_handler(DatasourceNotFoundError)
    async def datasource_not_found_handler(
        _request: Request,
        exc: DatasourceNotFoundError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={"detail": exc.message},
        )

    @app.exception_handler(SchemaError)
    async def schema_error_handler(
        _request: Request,
        exc: SchemaError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content={"detail": exc.message},
        )
