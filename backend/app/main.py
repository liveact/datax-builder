import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.datasource import router as datasource_router
from app.api.schema import router as schema_router
from app.core.config import get_config
from app.core.exceptions import register_exception_handlers
from app.services.datasource_service import dispose_all_engines

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    get_config()
    yield
    dispose_all_engines()


app = FastAPI(title="DataX Builder", lifespan=lifespan)

_cors_origins = get_config().server.cors_origins.split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(auth_router)
app.include_router(datasource_router)
app.include_router(schema_router)


@app.get("/")
def root() -> Dict[str, str]:
    return {"status": "ok", "service": "datax-builder"}
