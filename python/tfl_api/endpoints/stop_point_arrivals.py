from __future__ import annotations

import urllib.parse

from pydantic import BaseModel, Field

from tfl_api.client import TflClient
from tfl_api.models import ArrivalPrediction


class StopPointArrivalsRequest(BaseModel):
    stop_point_id: str = Field(min_length=1)


def get_stop_point_arrivals(
    client: TflClient, request: StopPointArrivalsRequest
) -> list[ArrivalPrediction]:
    stop_id = urllib.parse.quote(request.stop_point_id)
    return client.get_model(f"/StopPoint/{stop_id}/Arrivals", None, list[ArrivalPrediction])

