from __future__ import annotations

import urllib.parse

from pydantic import BaseModel, Field
from pydantic import TypeAdapter

from tfl_api.client import TflClient
from tfl_api.models import StopPoint


class StopPointDetailsRequest(BaseModel):
    stop_point_id: str = Field(min_length=1)


def get_stop_point_details(
    client: TflClient, request: StopPointDetailsRequest
) -> list[StopPoint]:
    stop_id = urllib.parse.quote(request.stop_point_id)
    data = client.get_json(f"/StopPoint/{stop_id}", None)
    if isinstance(data, list):
        return TypeAdapter(list[StopPoint]).validate_python(data)
    return [StopPoint.model_validate(data)]
