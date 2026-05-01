import { getJson } from "./client";
import type { StopPointSearchResponse } from "./types";

export type StopPointSearchRequest = {
  query: string;
  modes?: string[];
  includeHubs?: boolean;
  maxResults?: number;
};

/**
 * GET /StopPoint/Search/{query}
 *
 * Searches TfL stop/station metadata by free text. We use this first to turn a
 * user-entered station name into a TfL StopPoint, preferably one with `lat/lon`
 * so a nearby stop search can be performed around the inferred location.
 */
export function searchStopPoints(
  request: StopPointSearchRequest,
): Promise<StopPointSearchResponse> {
  return getJson<StopPointSearchResponse>(
    `/StopPoint/Search/${encodeURIComponent(request.query)}`,
    {
      modes: request.modes ?? ["bus"],
      includeHubs: request.includeHubs ?? true,
      maxResults: request.maxResults ?? 20,
    },
  );
}
