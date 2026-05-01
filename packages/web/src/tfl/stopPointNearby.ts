import { getJson } from "./client";
import type { NearbyStopPointsResponse } from "./types";

export type NearbyStopPointsRequest = {
  lat: number;
  lon: number;
  radius: number;
  modes: "bus" | "tube";
  stopTypes: string;
};

/**
 * GET /StopPoint
 *
 * Finds physical stop points around a latitude/longitude. TfL requires a mode
 * and stop type for useful results here, so callers make separate requests for
 * buses and Tube stations:
 *
 * - bus: `modes=bus&stopTypes=NaptanPublicBusCoachTram`
 * - tube: `modes=tube&stopTypes=NaptanMetroStation`
 */
export function getNearbyStopPoints(
  request: NearbyStopPointsRequest,
): Promise<NearbyStopPointsResponse> {
  return getJson<NearbyStopPointsResponse>("/StopPoint", {
    ...request,
  });
}
