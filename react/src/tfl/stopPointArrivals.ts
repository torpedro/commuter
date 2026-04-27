import { getJson } from "./client";
import type { ArrivalPrediction } from "./types";

export type StopPointArrivalsRequest = {
  stopPointId: string;
};

/**
 * GET /StopPoint/{id}/Arrivals
 *
 * Returns live prediction objects for a stop/station. This works for buses and
 * Tube stations in this app. London Bridge National Rail StopPoints exist in
 * TfL metadata, but this endpoint currently returns no useful train predictions
 * for those IDs, so National Rail/Darwin would be needed for Southeastern.
 */
export function getStopPointArrivals(
  request: StopPointArrivalsRequest,
): Promise<ArrivalPrediction[]> {
  return getJson<ArrivalPrediction[]>(
    `/StopPoint/${encodeURIComponent(request.stopPointId)}/Arrivals`,
  );
}
