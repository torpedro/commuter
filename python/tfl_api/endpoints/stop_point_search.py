from __future__ import annotations

import urllib.parse

from pydantic import BaseModel, Field

from tfl_api.client import TflClient
from tfl_api.models import StopPoint, TflModel


class StopPointSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    modes: list[str] = Field(default_factory=lambda: ["bus"])
    include_hubs: bool = Field(default=True, alias="includeHubs")
    max_results: int = Field(default=20, gt=0, alias="maxResults")


class StopPointSearchResponse(TflModel):
    matches: list[StopPoint] = Field(default_factory=list)


def search_stop_points(
    client: TflClient, request: StopPointSearchRequest
) -> StopPointSearchResponse:
    encoded_query = urllib.parse.quote(request.query)
    return client.get_model(
        f"/StopPoint/Search/{encoded_query}",
        request,
        StopPointSearchResponse,
    )
