export type QueryParamValue = string | number | boolean | string[] | undefined;

export type QueryParams = Record<string, QueryParamValue>;

export type ExplorerParamDef = {
  key: string;
  label: string;
  placeholder?: string;
  defaultValue: string;
  type?: "text" | "number";
};

export type ExplorerEndpointDef = {
  id: string;
  label: string;
  description: string;
  params: ExplorerParamDef[];
  buildPath: (values: Record<string, string>) => {
    path: string;
    params?: QueryParams;
  };
};

export type ExplorerEndpointGroup = {
  label: string;
  endpoints: ExplorerEndpointDef[];
};

export function explorerInputValues(
  endpoint: ExplorerEndpointDef,
  paramValues: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    endpoint.params.map((param) => [param.key, paramValues[param.key] ?? param.defaultValue]),
  );
}

export function explorerResultSummary(data: unknown): string {
  if (Array.isArray(data)) {
    return `Array — ${data.length} item${data.length === 1 ? "" : "s"}`;
  }
  if (data !== null && typeof data === "object") {
    const keys = Object.keys(data as object).length;
    return `Object — ${keys} key${keys === 1 ? "" : "s"}`;
  }
  return typeof data;
}

export function buildPreviewUrl(
  apiBase: string,
  endpoint: ExplorerEndpointDef,
  values: Record<string, string>,
): string {
  try {
    const { path, params } = endpoint.buildPath(values);
    const basePath = apiBase.endsWith("/") ? apiBase : `${apiBase}/`;
    const url = new URL(path.replace(/^\//, ""), basePath);
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
    return url.toString();
  } catch {
    return "";
  }
}
