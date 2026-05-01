const DEFAULT_API_BASE = "https://api.tfl.gov.uk";
export class TflApiError extends Error {
    constructor(message) {
        super(message);
        this.name = "TflApiError";
    }
}
export function createTflClient(config) {
    return {
        buildApiUrl(path, params) {
            return buildApiUrl(config, path, params);
        },
        async getJson(path, params) {
            const url = buildApiUrl(config, path, params);
            let response;
            try {
                response = await config.fetchFn(url.toString(), {
                    headers: {
                        Accept: "application/json",
                    },
                });
            }
            catch (caught) {
                const message = caught instanceof Error ? caught.message : String(caught);
                throw new TflApiError(`Could not request TfL endpoint ${path}: ${message}`);
            }
            const body = await response.text();
            const contentType = response.headers.get("content-type") ?? "unknown content type";
            if (!response.ok) {
                const detail = responsePreview(body);
                throw new TflApiError(detail
                    ? `TfL endpoint ${path} returned ${response.status} from ${url.pathname}. Response: ${detail}`
                    : `TfL endpoint ${path} returned ${response.status} from ${url.pathname}`);
            }
            try {
                return JSON.parse(body);
            }
            catch (caught) {
                const message = caught instanceof Error ? caught.message : String(caught);
                const detail = responsePreview(body);
                throw new TflApiError(`TfL endpoint ${path} returned invalid JSON from ${url.pathname}. Content-Type: ${contentType}. Parse error: ${message}. Response: ${detail}`);
            }
        },
    };
}
function resolveValue(value) {
    if (typeof value === "function") {
        return value().trim();
    }
    return value?.trim() ?? "";
}
function buildApiUrl(config, path, params) {
    const apiBase = resolveValue(config.apiBase) || DEFAULT_API_BASE;
    const basePath = apiBase.endsWith("/") ? apiBase : `${apiBase}/`;
    const documentBase = resolveValue(config.documentBase) || basePath;
    let url;
    try {
        url = new URL(`${basePath}${path.replace(/^\//, "")}`, documentBase);
    }
    catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        throw new TflApiError(`Could not build TfL API URL for endpoint ${path}. Base path: ${apiBase}. Document base: ${documentBase}. ${message}`);
    }
    for (const [key, value] of Object.entries(params ?? {})) {
        if (value === undefined) {
            continue;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                url.searchParams.append(key, String(item));
            }
        }
        else {
            url.searchParams.set(key, String(value));
        }
    }
    const apiKey = resolveValue(config.apiKey);
    if (apiKey && !url.searchParams.has("app_key")) {
        url.searchParams.set("app_key", apiKey);
    }
    return url;
}
function responsePreview(body) {
    return (body
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 260) || "empty response body");
}
