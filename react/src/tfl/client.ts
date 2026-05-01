const API_BASE = import.meta.env.VITE_TFL_API_BASE ?? "https://api.tfl.gov.uk";
const API_KEY = import.meta.env.VITE_TFL_API_KEY ?? "";
export const TFL_API_KEY_STORAGE_KEY = "commute.tflApiKey";

/**
 * Shared JSON client for TfL Unified API calls.
 *
 * The browser can persist an API key in localStorage; if present it overrides
 * the build-time `VITE_TFL_API_KEY`. The client appends the active key as
 * `app_key` unless the caller already supplied one. `VITE_TFL_API_BASE` can be
 * set for tests or a proxy, but production defaults to `https://api.tfl.gov.uk`.
 */
export class TflApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TflApiError";
  }
}

export async function getJson<T>(
  path: string,
  params?: Record<string, string | number | boolean | string[] | undefined>,
): Promise<T> {
  const url = buildApiUrl(path, params);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    throw new TflApiError(`Could not request TfL endpoint ${path}: ${message}`);
  }

  const body = await response.text();
  const contentType = response.headers.get("content-type") ?? "unknown content type";

  if (!response.ok) {
    const detail = responsePreview(body);
    throw new TflApiError(
      detail
        ? `TfL endpoint ${path} returned ${response.status} from ${url.pathname}. Response: ${detail}`
        : `TfL endpoint ${path} returned ${response.status} from ${url.pathname}`,
    );
  }

  try {
    return JSON.parse(body) as T;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    const detail = responsePreview(body);
    throw new TflApiError(
      `TfL endpoint ${path} returned invalid JSON from ${url.pathname}. Content-Type: ${contentType}. Parse error: ${message}. Response: ${detail}`,
    );
  }
}

export function readStoredApiKey(): string {
  try {
    return window.localStorage.getItem(TFL_API_KEY_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeStoredApiKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    window.localStorage.removeItem(TFL_API_KEY_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(TFL_API_KEY_STORAGE_KEY, trimmed);
}

export function activeApiKey(): string {
  return readStoredApiKey() || API_KEY;
}

function responsePreview(body: string): string {
  return (
    body
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 260) || "empty response body"
  );
}

function buildApiUrl(
  path: string,
  params?: Record<string, string | number | boolean | string[] | undefined>,
): URL {
  const basePath = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;
  let url: URL;

  try {
    url = new URL(`${basePath}${path.replace(/^\//, "")}`, document.baseURI);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    throw new TflApiError(
      `Could not build TfL API URL for endpoint ${path}. Base path: ${API_BASE}. Document base: ${document.baseURI}. ${message}`,
    );
  }

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, item);
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const apiKey = activeApiKey();
  if (apiKey && !url.searchParams.has("app_key")) {
    url.searchParams.set("app_key", apiKey);
  }

  return url;
}
