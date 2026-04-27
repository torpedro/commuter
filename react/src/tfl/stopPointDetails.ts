import { getJson } from "./client";
import type { StopPoint } from "./types";

export type StopPointDetailsRequest = {
  stopPointId: string;
};

/**
 * GET /StopPoint/{id}
 *
 * Fetches full StopPoint metadata. Search results sometimes omit useful fields
 * or point at an interchange/hub, so the app uses details to inspect child stop
 * points and find coordinates.
 */
export async function getStopPointDetails(
  request: StopPointDetailsRequest,
): Promise<StopPoint[]> {
  const data = await getJson<StopPoint | StopPoint[]>(
    `/StopPoint/${encodeURIComponent(request.stopPointId)}`,
  );
  return Array.isArray(data) ? data : [data];
}
