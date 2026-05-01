import { getStopPointArrivals } from "./stopPointArrivals";
import { getStopPointDetails } from "./stopPointDetails";
import { getNearbyStopPoints } from "./stopPointNearby";
import { searchStopPoints } from "./stopPointSearch";
import type { BusStop, Departure, GeoLocation, StopPoint } from "./types";

/**
 * High-level TfL departure flow used by the UI:
 *
 * 1. Search `/StopPoint/Search/{query}` to infer a geographic centre.
 * 2. Query `/StopPoint` nearby for bus stops and Tube stations around it.
 * 3. Query `/StopPoint/{id}/Arrivals` for every considered stop/station.
 *
 * If no location can be inferred, the code falls back to search/detail-based
 * bus stop expansion. This fallback is mainly for text searches that do not
 * resolve cleanly to coordinates.
 */
export type CollectBusStopsRequest = {
  query: string;
  maxStops: number;
  radius: number;
};

export type FetchDeparturesResult = {
  departures: Departure[];
  errors: string[];
};

export type CollectBusStopsResult = {
  stops: BusStop[];
  inferredLocation: GeoLocation | null;
};

function bestStopId(stop: StopPoint): string {
  return stop.naptanId ?? stop.id;
}

function isBusStop(stop: StopPoint): boolean {
  const modes = new Set((stop.modes ?? []).map((mode) => mode.toLowerCase()));
  const stopType = (stop.stopType ?? "").toLowerCase();
  return modes.has("bus") || stopType.includes("bus");
}

function displayStopName(stop: StopPoint, fallback?: string): string {
  const name = stop.commonName ?? fallback ?? bestStopId(stop);
  if (stop.stopLetter && !name.includes(stop.stopLetter.trim())) {
    return `${name} stop ${stop.stopLetter}`;
  }
  return name;
}

function coordinates(stop: StopPoint): GeoLocation | null {
  if (typeof stop.lat === "number" && typeof stop.lon === "number") {
    return { lat: stop.lat, lon: stop.lon };
  }
  return null;
}

function detailCandidates(details: StopPoint[]): StopPoint[] {
  const candidates: StopPoint[] = [];
  for (const detail of details) {
    candidates.push(detail, ...(detail.children ?? []));
  }
  return candidates;
}

async function resolveSearchCentre(
  query: string,
): Promise<GeoLocation | null> {
  const response = await searchStopPoints({ query, maxResults: 10 });

  for (const match of response.matches) {
    const matchCoordinates = coordinates(match);
    if (matchCoordinates) {
      return matchCoordinates;
    }

    const details = await getStopPointDetails({ stopPointId: bestStopId(match) });
    for (const detail of detailCandidates(details)) {
      const detailCoordinates = coordinates(detail);
      if (detailCoordinates) {
        return detailCoordinates;
      }
    }
  }

  return null;
}

async function collectNearbyBusStops(
  lat: number,
  lon: number,
  radius: number,
  maxStops: number,
): Promise<BusStop[]> {
  const responses = await Promise.all([
    getNearbyStopPoints({
      lat,
      lon,
      radius,
      modes: "bus",
      stopTypes: "NaptanPublicBusCoachTram",
    }),
    getNearbyStopPoints({
      lat,
      lon,
      radius,
      modes: "tube",
      stopTypes: "NaptanMetroStation",
    }),
  ]);
  const seen = new Set<string>();
  const stops: BusStop[] = [];

  for (const response of responses) {
    for (const stop of response.stopPoints) {
      const id = bestStopId(stop);
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      stops.push({
        id,
        name: displayStopName(stop),
        location: coordinates(stop),
        mode: stop.modes?.includes("tube") ? "tube" : "bus",
      });
      if (stops.length >= maxStops) {
        return stops;
      }
    }
  }

  return stops;
}

function busStopCandidates(details: StopPoint[]): StopPoint[] {
  const candidates: StopPoint[] = [];
  for (const detail of details) {
    if (isBusStop(detail)) {
      candidates.push(detail);
    }
    candidates.push(...(detail.children ?? []).filter(isBusStop));
  }
  return candidates;
}

async function collectSearchedBusStops(
  query: string,
  maxStops: number,
): Promise<BusStop[]> {
  const response = await searchStopPoints({ query, maxResults: 20 });
  const matches = response.matches.filter(isBusStop);

  const seen = new Set<string>();
  const stops: BusStop[] = [];

  for (const match of matches) {
    const details = await getStopPointDetails({ stopPointId: bestStopId(match) });
    for (const candidate of busStopCandidates(details)) {
      const id = bestStopId(candidate);
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      stops.push({
        id,
        name: displayStopName(candidate, match.commonName),
        location: coordinates(candidate),
        mode: candidate.modes?.includes("tube") ? "tube" : "bus",
      });
      if (stops.length >= maxStops) {
        return stops;
      }
    }
  }

  return stops;
}

export async function collectBusStops(
  request: CollectBusStopsRequest,
): Promise<CollectBusStopsResult> {
  const searchCentre = await resolveSearchCentre(request.query);
  if (searchCentre) {
    const nearbyStops = await collectNearbyBusStops(
      searchCentre.lat,
      searchCentre.lon,
      request.radius,
      request.maxStops,
    );
    if (nearbyStops.length > 0) {
      return {
        stops: nearbyStops,
        inferredLocation: searchCentre,
      };
    }
  }

  return {
    stops: await collectSearchedBusStops(request.query, request.maxStops),
    inferredLocation: searchCentre,
  };
}

export async function fetchDepartures(stops: BusStop[]): Promise<FetchDeparturesResult> {
  const results = await Promise.all(
    stops.map(async (stop) => {
      try {
        const arrivals = await getStopPointArrivals({ stopPointId: stop.id });
        return {
          departures: arrivals.map((prediction) => ({
            prediction,
            stopName: stop.name,
          })),
          error: null,
        };
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "Unknown API error";
        return {
          departures: [],
          error: `${stop.name}: ${message}`,
        };
      }
    }),
  );

  return {
    departures: results
      .flatMap((result) => result.departures)
      .sort((a, b) => a.prediction.timeToStation - b.prediction.timeToStation),
    errors: results
      .map((result) => result.error)
      .filter((error): error is string => error !== null),
  };
}

export function filterDeparturesByLines(
  departures: Departure[],
  lines: string[],
): Departure[] {
  if (lines.length === 0) {
    return departures;
  }

  const wanted = new Set(lines.map((line) => line.toLowerCase()));
  return departures.filter((departure) =>
    wanted.has(departure.prediction.lineName.toLowerCase()),
  );
}
