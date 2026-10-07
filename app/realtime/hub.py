"""
In-process WebSocket connection hub.

Connections are grouped by user id; every event is published to exactly
one user (the owner of the device it concerns), so one user's events can
never reach another user's sockets.

Threading model: all connection state lives on the server's event loop.
`publish()` is thread-safe — sync route handlers (run in the threadpool)
and the device monitor thread call it, and delivery is scheduled onto the
loop with `call_soon_threadsafe`. Each connection has a bounded queue
drained by its own sender task, so a slow client can never block the
publisher or other clients; a client that falls too far behind is
disconnected.

Single-process by design. Running several API workers would need a shared
broker (e.g. Redis pub/sub) behind `publish()`.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)

QUEUE_SIZE = 256
CLOSE_SLOW_CONSUMER = 4008


@dataclass(eq=False)
class Connection:
    websocket: WebSocket
    user_id: int
    queue: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(maxsize=QUEUE_SIZE))
    overflowed: bool = False


class RealtimeHub:
    def __init__(self) -> None:
        self._loop: asyncio.AbstractEventLoop | None = None
        self._by_user: dict[int, set[Connection]] = {}

    # ---------------------------------------------------------- lifecycle

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def unbind_loop(self) -> None:
        self._loop = None
        self._by_user.clear()

    def register(self, connection: Connection) -> None:
        """Call on the event loop."""
        self._by_user.setdefault(connection.user_id, set()).add(connection)

    def unregister(self, connection: Connection) -> None:
        """Call on the event loop. Safe to call more than once."""
        connections = self._by_user.get(connection.user_id)
        if connections is not None:
            connections.discard(connection)
            if not connections:
                del self._by_user[connection.user_id]

    def connection_count(self, user_id: int | None = None) -> int:
        if user_id is not None:
            return len(self._by_user.get(user_id, ()))
        return sum(len(c) for c in self._by_user.values())

    # ---------------------------------------------------------- publishing

    def publish(self, user_id: int, event: dict[str, Any]) -> None:
        """
        Deliver `event` to every connection of `user_id`. Thread-safe and
        non-blocking; a no-op when no event loop is bound (e.g. scripts).
        """
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        try:
            loop.call_soon_threadsafe(self._dispatch, user_id, event)
        except RuntimeError:
            # Loop shutting down.
            pass

    def _dispatch(self, user_id: int, event: dict[str, Any]) -> None:
        for connection in list(self._by_user.get(user_id, ())):
            if connection.overflowed:
                continue
            try:
                connection.queue.put_nowait(event)
            except asyncio.QueueFull:
                connection.overflowed = True
                logger.warning("Closing slow WebSocket consumer for user %s", user_id)
                asyncio.ensure_future(self._close_slow(connection))

    async def _close_slow(self, connection: Connection) -> None:
        self.unregister(connection)
        try:
            await connection.websocket.close(code=CLOSE_SLOW_CONSUMER, reason="Client too slow")
        except Exception:
            pass


hub = RealtimeHub()
