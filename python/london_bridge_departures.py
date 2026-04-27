#!/usr/bin/env python3
"""Print upcoming TfL bus departures around London Bridge Station."""

from __future__ import annotations

import argparse
import datetime as dt
import os
import sys
import urllib.parse
from dataclasses import dataclass
from pathlib import Path

from tfl_api.client import TflApiError, TflClient
from tfl_api.endpoints.stop_point_arrivals import (
    StopPointArrivalsRequest,
    get_stop_point_arrivals,
)
from tfl_api.endpoints.stop_point_details import (
    StopPointDetailsRequest,
    get_stop_point_details,
)
from tfl_api.endpoints.stop_point_nearby import (
    NearbyStopPointsRequest,
    get_nearby_stop_points,
)
from tfl_api.endpoints.stop_point_search import (
    StopPointSearchRequest,
    search_stop_points,
)
from tfl_api.models import ArrivalPrediction, StopPoint


DEFAULT_QUERY = "London Bridge Station"
DEFAULT_KEY_FILE = "apikey"
DEFAULT_RADIUS_METRES = 250


@dataclass(frozen=True)
class BusStop:
    id: str
    name: str


@dataclass(frozen=True)
class Departure:
    prediction: ArrivalPrediction
    stop_name: str


@dataclass(frozen=True)
class Coordinates:
    lat: float
    lon: float


def read_api_key(path: str) -> str:
    key = os.environ.get("TFL_API_KEY", "").strip()
    if key:
        return key

    key_path = Path(path)
    if not key_path.exists():
        raise RuntimeError(f"No API key found. Set TFL_API_KEY or create {key_path}.")

    raw = key_path.read_text(encoding="utf-8").strip()
    if "=" in raw:
        parsed = urllib.parse.parse_qs(raw.replace("\n", "&"))
        raw = parsed.get("app_key", [raw])[0]

    key = raw.strip().strip('"').strip("'")
    if not key:
        raise RuntimeError(f"{key_path} is empty.")
    return key


def collect_nearby_bus_stops(
    client: TflClient,
    lat: float,
    lon: float,
    radius: int,
    max_stops: int,
) -> list[BusStop]:
    response = get_nearby_stop_points(
        client,
        NearbyStopPointsRequest(lat=lat, lon=lon, radius=radius),
    )

    stops: list[BusStop] = []
    seen: set[str] = set()
    for stop in response.stop_points:
        if stop.best_id in seen:
            continue
        seen.add(stop.best_id)
        stops.append(BusStop(id=stop.best_id, name=stop.display_name()))
        if len(stops) >= max_stops:
            break
    return stops


def stop_coordinates(stop: StopPoint) -> Coordinates | None:
    if stop.lat is not None and stop.lon is not None:
        return Coordinates(lat=stop.lat, lon=stop.lon)
    return None


def detail_candidates(details: list[StopPoint]) -> list[StopPoint]:
    candidates: list[StopPoint] = []
    for detail in details:
        candidates.append(detail)
        candidates.extend(detail.children)
    return candidates


def resolve_search_centre(client: TflClient, query: str) -> Coordinates | None:
    response = search_stop_points(
        client,
        StopPointSearchRequest(query=query, maxResults=10),
    )

    for match in response.matches:
        match_coordinates = stop_coordinates(match)
        if match_coordinates is not None:
            return match_coordinates

        details = get_stop_point_details(
            client,
            StopPointDetailsRequest(stop_point_id=match.best_id),
        )
        for detail in detail_candidates(details):
            detail_coordinates = stop_coordinates(detail)
            if detail_coordinates is not None:
                return detail_coordinates

    return None


def collect_searched_bus_stops(
    client: TflClient,
    query: str,
    max_stops: int,
) -> list[BusStop]:
    response = search_stop_points(
        client,
        StopPointSearchRequest(query=query, maxResults=20),
    )
    matches = [match for match in response.matches if match.is_bus_stop]
    if not matches and query != "London Bridge Bus Station":
        fallback = search_stop_points(
            client,
            StopPointSearchRequest(query="London Bridge Bus Station", maxResults=20),
        )
        matches = [match for match in fallback.matches if match.is_bus_stop]

    seen: set[str] = set()
    stops: list[BusStop] = []

    for match in matches:
        details = get_stop_point_details(
            client,
            StopPointDetailsRequest(stop_point_id=match.best_id),
        )
        for candidate in bus_stop_candidates(details):
            if candidate.best_id in seen:
                continue
            seen.add(candidate.best_id)
            stops.append(BusStop(id=candidate.best_id, name=candidate.display_name(match.common_name)))
            if len(stops) >= max_stops:
                return stops

    return stops


def bus_stop_candidates(details: list[StopPoint]) -> list[StopPoint]:
    candidates: list[StopPoint] = []
    for detail in details:
        if detail.is_bus_stop:
            candidates.append(detail)
        candidates.extend(child for child in detail.children if child.is_bus_stop)
    return candidates


def collect_bus_stops(
    client: TflClient,
    query: str,
    max_stops: int,
    lat: float | None,
    lon: float | None,
    radius: int,
) -> list[BusStop]:
    if lat is not None and lon is not None:
        nearby_stops = collect_nearby_bus_stops(client, lat, lon, radius, max_stops)
        if nearby_stops:
            return nearby_stops

    search_centre = resolve_search_centre(client, query)
    if search_centre is not None:
        nearby_stops = collect_nearby_bus_stops(
            client,
            search_centre.lat,
            search_centre.lon,
            radius,
            max_stops,
        )
        if nearby_stops:
            return nearby_stops

    return collect_searched_bus_stops(client, query, max_stops)


def fetch_departures(client: TflClient, stops: list[BusStop]) -> list[Departure]:
    departures: list[Departure] = []

    for stop in stops:
        arrivals = get_stop_point_arrivals(
            client,
            StopPointArrivalsRequest(stop_point_id=stop.id),
        )
        departures.extend(
            Departure(prediction=arrival, stop_name=stop.name)
            for arrival in arrivals
        )

    return sorted(
        departures,
        key=lambda departure: departure.prediction.time_to_station,
    )


def filter_departures_by_lines(
    departures: list[Departure], lines: list[str] | None
) -> list[Departure]:
    if not lines:
        return departures

    wanted = {line.lower() for line in lines}
    return [
        departure
        for departure in departures
        if departure.prediction.line_name.lower() in wanted
    ]


def format_departure(departure: Departure, now: dt.datetime) -> str:
    due = departure.prediction.time_to_station
    due_time = now + dt.timedelta(seconds=due)
    minutes = max(0, round(due / 60))

    due_text = "due" if minutes == 0 else f"{minutes} min"
    prediction = departure.prediction

    return (
        f"{due_time:%H:%M}  {due_text:>6}  {prediction.line_name:<5}  "
        f"{prediction.destination_name}  ({departure.stop_name})"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Print upcoming TfL bus departures around London Bridge Station."
    )
    parser.add_argument(
        "--query",
        default=DEFAULT_QUERY,
        help=f"Stop search query. Default: {DEFAULT_QUERY!r}",
    )
    parser.add_argument(
        "--key-file",
        default=DEFAULT_KEY_FILE,
        help=f"File containing the TfL app_key. Default: {DEFAULT_KEY_FILE!r}",
    )
    parser.add_argument(
        "--max-stops",
        type=int,
        default=25,
        help="Maximum bus stops to query after searching. Default: 25",
    )
    parser.add_argument(
        "--lat",
        type=float,
        default=None,
        help="Optional latitude override for nearby bus stop search.",
    )
    parser.add_argument(
        "--lon",
        type=float,
        default=None,
        help="Optional longitude override for nearby bus stop search.",
    )
    parser.add_argument(
        "--radius",
        type=int,
        default=DEFAULT_RADIUS_METRES,
        help=f"Nearby stop search radius in metres. Default: {DEFAULT_RADIUS_METRES}",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Maximum departures to print. Default: 20",
    )
    parser.add_argument(
        "--line",
        action="append",
        help="Only show a specific bus route. Can be repeated, e.g. --line 149 --line 381",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        client = TflClient(read_api_key(args.key_file))
        stops = collect_bus_stops(
            client,
            args.query,
            args.max_stops,
            args.lat,
            args.lon,
            args.radius,
        )
        if not stops:
            print(f"No bus stops found for {args.query!r}.", file=sys.stderr)
            return 1

        departures = filter_departures_by_lines(fetch_departures(client, stops), args.line)
    except (RuntimeError, TflApiError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    now = dt.datetime.now()
    line_text = f" for route(s) {', '.join(args.line)}" if args.line else ""
    print(f"Upcoming buses{line_text} near {args.query}")
    print(f"Checked {len(stops)} stop(s): {', '.join(stop.name for stop in stops)}")
    print()

    if not departures:
        print("No live bus departures returned by TfL right now.")
        return 0

    for departure in departures[: args.limit]:
        print(format_departure(departure, now))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
