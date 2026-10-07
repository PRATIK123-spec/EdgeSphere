"""
Authenticated real-time channel: WS /ws

Handshake (the JWT never goes in the URL):

    client -> {"type": "auth", "token": "<access token>"}      within WS_AUTH_TIMEOUT_SECONDS
    server -> {"type": "ready", "user_id": 1, "expires_at": <epoch s>, "v": 1}

Then the server pushes events (see app/realtime/events.py) for devices the
user owns, plus {"type": "ping"} heartbeats. The client may send
{"type": "ping"} and gets {"type": "pong"}.

Close codes:
    4401  not authenticated / invalid or expired token (also sent when the
          token expires during the session) — do not retry with the same token
    4408  no auth message within the timeout
    4400  malformed message
    4008  client too slow to keep up (from the hub)

Each authentication uses a short-lived DB session in the threadpool; no
session is held for the lifetime of the socket.
"""

import asyncio
import contextlib
import json
import logging
import time

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool
from starlette.websockets import WebSocketState

from app.core.config import settings
from app.core.security import authenticate_access_token
from app.database.dependencies import SessionFactory, get_session_factory
from app.realtime.events import PROTOCOL_VERSION
from app.realtime.hub import Connection, hub

logger = logging.getLogger(__name__)

router = APIRouter()

CLOSE_UNAUTHORIZED = 4401
CLOSE_AUTH_TIMEOUT = 4408
CLOSE_BAD_MESSAGE = 4400
MAX_MESSAGE_BYTES = 4096


def _authenticate(token: str, session_factory: SessionFactory) -> tuple[int, int] | None:
    """(user_id, expiry epoch) for a valid token of an active user, else None."""
    try:
        with session_factory() as db:
            user, expires_at = authenticate_access_token(token, db)
            return user.id, expires_at
    except HTTPException:
        return None


async def _close(websocket: WebSocket, code: int, reason: str) -> None:
    if websocket.application_state != WebSocketState.DISCONNECTED:
        with contextlib.suppress(Exception):
            await websocket.close(code=code, reason=reason)


async def _receive_json(websocket: WebSocket) -> dict | None:
    """Next message as a JSON object, or None if it is malformed."""
    text = await websocket.receive_text()
    if len(text) > MAX_MESSAGE_BYTES:
        return None
    try:
        message = json.loads(text)
    except ValueError:
        return None
    return message if isinstance(message, dict) else None


async def _sender(connection: Connection) -> None:
    """Drain the connection's queue to the socket, with periodic heartbeats."""
    websocket = connection.websocket
    try:
        while True:
            try:
                event = await asyncio.wait_for(connection.queue.get(), timeout=settings.WS_HEARTBEAT_SECONDS)
            except TimeoutError:
                event = {"type": "ping"}
            await websocket.send_json(event)
    except asyncio.CancelledError:
        raise
    except Exception:
        # Broken socket: close it so the receive loop ends and cleanup runs.
        await _close(websocket, 1011, "Send failed")


async def _expire(websocket: WebSocket, expires_at: int) -> None:
    await asyncio.sleep(max(0.0, expires_at - time.time()))
    await _close(websocket, CLOSE_UNAUTHORIZED, "Token expired")


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    session_factory: SessionFactory = Depends(get_session_factory),
):
    await websocket.accept()

    # ---- authenticate (first message) ---------------------------------
    try:
        message = await asyncio.wait_for(_receive_json(websocket), timeout=settings.WS_AUTH_TIMEOUT_SECONDS)
    except TimeoutError:
        await _close(websocket, CLOSE_AUTH_TIMEOUT, "Authentication timeout")
        return
    except WebSocketDisconnect:
        return

    token = message.get("token") if message and message.get("type") == "auth" else None
    if not isinstance(token, str) or not token:
        await _close(websocket, CLOSE_UNAUTHORIZED, "Authentication required")
        return

    identity = await run_in_threadpool(_authenticate, token, session_factory)
    if identity is None:
        await _close(websocket, CLOSE_UNAUTHORIZED, "Invalid or expired token")
        return
    user_id, expires_at = identity

    # ---- serve -------------------------------------------------------------
    connection = Connection(websocket=websocket, user_id=user_id)
    hub.register(connection)
    tasks: list[asyncio.Task] = []
    try:
        await websocket.send_json({"type": "ready", "v": PROTOCOL_VERSION, "user_id": user_id, "expires_at": expires_at})
        tasks = [
            asyncio.create_task(_sender(connection)),
            asyncio.create_task(_expire(websocket, expires_at)),
        ]

        while True:
            message = await _receive_json(websocket)
            if message is None:
                await _close(websocket, CLOSE_BAD_MESSAGE, "Malformed message")
                break
            if message.get("type") == "ping":
                await connection.queue.put({"type": "pong"})
            # Anything else from the client is ignored (server-push channel).
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        hub.unregister(connection)
        for task in tasks:
            task.cancel()
        for task in tasks:
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await task
