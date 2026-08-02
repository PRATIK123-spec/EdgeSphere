from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

connected_clients = []


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    connected_clients.append(websocket)

    print("Client Connected")

    try:
        while True:
            data = await websocket.receive_text()

            print("Received:", data)

            # Echo the message back
            await websocket.send_text(f"Server received: {data}")

    except WebSocketDisconnect:
        print("Client Disconnected")
        connected_clients.remove(websocket)