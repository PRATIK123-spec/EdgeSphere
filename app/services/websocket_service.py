from app.routers.websocket import connected_clients


async def broadcast(message: dict):

    disconnected = []

    for client in connected_clients:

        try:
            await client.send_json(message)

        except:
            disconnected.append(client)

    for client in disconnected:
        connected_clients.remove(client)