import type { QueryParams } from "../explorer/types.js";

export type FetchLikeResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  headers: {
    get(name: string): string | null;
  };
};

export type FetchLike = (
  input: string,
  init?: {
    headers?: Record<string, string>;
  },
) => Promise<FetchLikeResponse>;

export type TflClientConfig = {
  apiBase?: string | (() => string);
  apiKey?: string | (() => string);
  documentBase?: string | (() => string);
  fetchFn: FetchLike;
};

const DEFAULT_API_BASE = "https://api.tfl.gov.uk";

export class TflApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TflApiError";
  }
}

export function createTflClient(config: TflClientConfig) {
  return {
    buildApiUrl(path: string, params?: QueryParams): URL {
      return buildApiUrl(config, path, params);
    },
    async getJson<T>(path: string, params?: QueryParams): Promise<T> {
      const url = buildApiUrl(config, path, params);

      let response: FetchLikeResponse;
      try {
        response = await config.fetchFn(url.toString(), {
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
    },
  };
}

function resolveValue(value: string | (() => string) | undefined): string {
  if (typeof value === "function") {
    return value().trim();
  }
  return value?.trim() ?? "";
}

function buildApiUrl(config: TflClientConfig, path: string, params?: QueryParams): URL {
  const apiBase = resolveValue(config.apiBase) || DEFAULT_API_BASE;
  const basePath = apiBase.endsWith("/") ? apiBase : `${apiBase}/`;
  const documentBase = resolveValue(config.documentBase) || basePath;
  let url: URL;

  try {
    url = new URL(`${basePath}${path.replace(/^\//, "")}`, documentBase);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    throw new TflApiError(
      `Could not build TfL API URL for endpoint ${path}. Base path: ${apiBase}. Document base: ${documentBase}. ${message}`,
    );
  }

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const apiKey = resolveValue(config.apiKey);
  if (apiKey && !url.searchParams.has("app_key")) {
    url.searchParams.set("app_key", apiKey);
  }

  return url;
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
