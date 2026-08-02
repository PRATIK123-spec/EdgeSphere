from pydantic import BaseModel


class DeviceCreate(BaseModel):
    name: str
    status: str


class DeviceResponse(BaseModel):
    id: int
    name: str
    status: str

    model_config = {
        "from_attributes": True
    }