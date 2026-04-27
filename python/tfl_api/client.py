from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, TypeVar

from pydantic import BaseModel, TypeAdapter


API_BASE = "https://api.tfl.gov.uk"
USER_AGENT = "tfl-commute/0.1 (+https://api.tfl.gov.uk)"

T = TypeVar("T")


class TflApiError(RuntimeError):
    """Raised when TfL cannot be reached or returns an error response."""


class TflClient:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def get_model(
        self,
        path: str,
        params: BaseModel | dict[str, Any] | None,
        model_type: type[T],
    ) -> T:
        data = self.get_json(path, params)
        return TypeAdapter(model_type).validate_python(data)

    def get_json(self, path: str, params: BaseModel | dict[str, Any] | None) -> Any:
        query: dict[str, Any] = {"app_key": self.api_key}
        if isinstance(params, BaseModel):
            query.update(params.model_dump(exclude_none=True, by_alias=True))
        elif params:
            query.update(params)

        url = f"{API_BASE}{path}?{urllib.parse.urlencode(query, doseq=True)}"
        request = urllib.request.Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": USER_AGENT,
            },
        )

        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            detail = detail.replace(self.api_key, "[redacted]")
            raise TflApiError(
                f"TfL API returned HTTP {exc.code} for {path}: {detail}"
            ) from exc
        except urllib.error.URLError as exc:
            raise TflApiError(f"Could not reach TfL API: {exc.reason}") from exc

