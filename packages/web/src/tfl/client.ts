import {
  createTflClient,
  TflApiError,
} from "@commute/shared/tfl/client";

const API_BASE = import.meta.env.VITE_TFL_API_BASE ?? "https://api.tfl.gov.uk";
const API_KEY = import.meta.env.VITE_TFL_API_KEY ?? "";
export const TFL_API_KEY_STORAGE_KEY = "commute.savedTflApiKey.v1";

const browserTflClient = createTflClient({
  apiBase: () => API_BASE,
  apiKey: () => activeApiKey(),
  documentBase: () => document.baseURI,
  fetchFn: async (input, init) => fetch(input, init),
});

export { TflApiError };

export function getJson<T>(
  path: string,
  params?: Record<string, string | number | boolean | string[] | undefined>,
): Promise<T> {
  return browserTflClient.getJson<T>(path, params);
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
