from __future__ import annotations

from pydantic import BaseModel, Field

from tfl_api.client import TflClient
from tfl_api.models import StopPoint, TflModel


class NearbyStopPointsRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    radius: int = Field(gt=0)
    modes: str = "bus"
    stop_types: str = Field(
        default="NaptanPublicBusCoachTram",
        alias="stopTypes",
    )


class NearbyStopPointsResponse(TflModel):
    stop_points: list[StopPoint] = Field(default_factory=list, alias="stopPoints")
    page_size: int | None = Field(default=None, alias="pageSize")
    total: int | None = None
    page: int | None = None


def get_nearby_stop_points(
    client: TflClient, request: NearbyStopPointsRequest
) -> NearbyStopPointsResponse:
    return client.get_model("/StopPoint", request, NearbyStopPointsResponse)

