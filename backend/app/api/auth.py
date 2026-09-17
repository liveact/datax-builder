import time
from collections import defaultdict
from datetime import timedelta
from typing import Dict, List

from fastapi import APIRouter, HTTPException, status

from app.core.config import get_config
from app.core.exceptions import AuthenticationError
from app.core.security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    verify_password,
)
from app.models.auth import LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

_LOGIN_ATTEMPTS: Dict[str, List[float]] = defaultdict(list)
_MAX_ATTEMPTS = 5
_WINDOW_SECONDS = 300
_MAX_TRACKED_USERS = 1000


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest) -> TokenResponse:
    now = time.time()

    if len(_LOGIN_ATTEMPTS) > _MAX_TRACKED_USERS:
        expired_keys = [
            k for k, v in _LOGIN_ATTEMPTS.items()
            if not v or now - v[-1] > _WINDOW_SECONDS
        ]
        for k in expired_keys:
            del _LOGIN_ATTEMPTS[k]

    attempts = _LOGIN_ATTEMPTS[request.username]
    _LOGIN_ATTEMPTS[request.username] = [t for t in attempts if now - t < _WINDOW_SECONDS]

    if len(_LOGIN_ATTEMPTS[request.username]) >= _MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="登录尝试次数过多，请稍后再试",
        )

    config = get_config()
    user = config.users.get(request.username)
    if not user or not verify_password(request.password, user.password_hash):
        _LOGIN_ATTEMPTS[request.username].append(now)
        raise AuthenticationError("Invalid username or password")

    _LOGIN_ATTEMPTS[request.username].clear()

    access_token = create_access_token(
        data={"sub": request.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return TokenResponse(access_token=access_token, token_type="bearer")
