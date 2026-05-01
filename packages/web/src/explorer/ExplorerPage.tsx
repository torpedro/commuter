import { useMemo, useState } from "react";
import {
  buildPreviewUrl,
  explorerInputValues,
  explorerResultSummary,
  type ExplorerEndpointDef,
} from "@commute/shared/explorer/types";
import type {
  DataEntityDef,
  DataEntityRow,
  ProviderWorkbenchDef,
} from "@commute/shared/explorer/provider";
import { TFL_PROVIDER } from "@commute/shared/providers";
import {
  EXPLORER_ENDPOINTS,
  TFL_API_BASE,
} from "@commute/shared/tfl/explorer";
import { activeApiKey, getJson, readStoredApiKey, writeStoredApiKey } from "../tfl/client";

type ExplorerPageProps = {
  HeaderBar: (props: {
    currentPage: "home" | "search" | "explorer";
    extraAction?: React.ReactNode;
  }) => React.ReactNode;
};

type ExplorerCellState = {
  paramValues: Record<string, string>;
  loading: boolean;
  result: unknown;
  error: string | null;
  meta: { ms: number; summary: string; bytes: number } | null;
};

const EXPLORER_ENDPOINT_BY_ID = Object.fromEntries(
  EXPLORER_ENDPOINTS.map((endpoint) => [endpoint.id, endpoint]),
) as Record<string, ExplorerEndpointDef>;

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightJson(value: unknown): string {
  const formatted = escapeHtml(JSON.stringify(value, null, 2));
  return formatted.replace(
    /("(?:\\.|[^"\\])*"(\s*:)?|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      if (/:$/.test(match)) return `<span class="json-key">${match}</span>`;
      if (match.startsWith('"')) return `<span class="json-string">${match}</span>`;
      if (match === "true" || match === "false") return `<span class="json-bool">${match}</span>`;
      if (match === "null") return `<span class="json-null">${match}</span>`;
      return `<span class="json-number">${match}</span>`;
    },
  );
}

function initialExplorerCellState(): ExplorerCellState {
  return {
    paramValues: {},
    loading: false,
    result: undefined,
    error: null,
    meta: null,
  };
}

function stopPointBestId(match: {
  naptanId?: string;
  id: string;
}): string {
  return match.naptanId ?? match.id;
}

function copyToClipboard(value: string) {
  void navigator.clipboard.writeText(value);
}

function scrollToExplorerCell(endpointId: string) {
  document.getElementById(`cell-${endpointId}`)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function EntityTable({
  rows,
  copied,
  onCopy,
}: {
  rows: DataEntityRow[];
  copied: string | null;
  onCopy: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="entity-table-wrap">
      <table className="entity-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>ID</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td><code className="entity-id-code">{row.id}</code></td>
              <td>
                <button
                  className="entity-copy-btn"
                  type="button"
                  onClick={() => onCopy(row.id)}
                >
                  {copied === row.id ? "Copied!" : "Copy"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function searchEntityRows(entity: DataEntityDef, query: string): Promise<DataEntityRow[]> {
  if (entity.search?.kind === "tfl-bus-stops") {
    const data = await getJson<{
      matches: Array<{ commonName?: string; naptanId?: string; id: string; stopLetter?: string }>;
    }>(`/StopPoint/Search/${encodeURIComponent(query)}`, {
      modes: ["bus"],
      maxResults: 50,
      includeHubs: false,
    });
    return data.matches.map((stop) => ({
      name: stop.stopLetter
        ? `${stop.commonName ?? stop.id} (Stop ${stop.stopLetter})`
        : (stop.commonName ?? stop.id),
      id: stop.naptanId ?? stop.id,
    }));
  }

  return [];
}

function ReferenceCard({ entity }: { entity: DataEntityDef }) {
  const [filter, setFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DataEntityRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const isDynamic = Boolean(entity.search);

  const staticRows = useMemo(() => {
    if (!entity.rows) return [];
    const q = filter.toLowerCase();
    if (!q) return entity.rows;
    return entity.rows.filter(
      (row) => row.name.toLowerCase().includes(q) || row.id.toLowerCase().includes(q),
    );
  }, [entity.rows, filter]);

  async function doSearch() {
    if (!entity.search || !searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      setSearchResults(await searchEntityRows(entity, searchQuery.trim()));
    } catch (caught) {
      setSearchError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSearching(false);
    }
  }

  function copy(id: string) {
    copyToClipboard(id);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <section className="reference-card">
      <div className="reference-card-header">
        <h3 className="reference-card-title">{entity.label}</h3>
        <p className="reference-card-desc">{entity.description}</p>
      </div>

      {isDynamic ? (
        <div className="entity-filter-row">
          <input
            className="entity-filter-input"
            placeholder={entity.search?.placeholder ?? "Search…"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void doSearch(); }}
          />
          <button
            className="explorer-execute"
            type="button"
            onClick={() => void doSearch()}
            disabled={searching}
          >
            {searching ? "Searching…" : entity.search?.buttonLabel ?? "Search"}
          </button>
          {searchResults !== null && !searching ? (
            <span className="entity-count">{searchResults.length} results</span>
          ) : null}
        </div>
      ) : (
        <div className="entity-filter-row">
          <input
            className="entity-filter-input"
            placeholder="Filter…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <span className="entity-count">
            {staticRows.length}{filter ? ` of ${entity.rows!.length}` : ""} items
          </span>
        </div>
      )}

      {searchError ? (
        <section className="errors" aria-label="Search error">
          <strong>Error</strong>
          <p style={{ margin: "4px 0 0" }}>{searchError}</p>
        </section>
      ) : null}

      {isDynamic ? (
        searchResults !== null && !searching && searchResults.length === 0 ? (
          <div className="empty">No stops found for that search.</div>
        ) : (
          <EntityTable rows={searchResults ?? []} copied={copied} onCopy={copy} />
        )
      ) : (
        <EntityTable rows={staticRows} copied={copied} onCopy={copy} />
      )}
    </section>
  );
}

function NotebookStopSearchResults({
  result,
  onUseValues,
}: {
  result: unknown;
  onUseValues: (
    endpointId: string,
    values: Record<string, string>,
    options?: { execute?: boolean },
  ) => void;
}) {
  if (
    !result ||
    typeof result !== "object" ||
    !("matches" in result) ||
    !Array.isArray((result as { matches?: unknown }).matches)
  ) {
    return null;
  }

  const matches = (result as {
    matches: Array<{
      id: string;
      naptanId?: string;
      commonName?: string;
      stopLetter?: string;
      lat?: number;
      lon?: number;
    }>;
  }).matches;

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className="linked-result-panel">
      <div className="linked-result-header">
        <strong>Follow-on actions</strong>
        <span>{matches.length} search matches ready to feed into other cells</span>
      </div>
      <div className="linked-result-table-wrap">
        <table className="linked-result-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {matches.slice(0, 12).map((match) => {
              const stopId = stopPointBestId(match);
              const displayName = match.stopLetter
                ? `${match.commonName ?? match.id} (Stop ${match.stopLetter})`
                : match.commonName ?? match.id;
              return (
                <tr key={`${match.id}-${stopId}`}>
                  <td>{displayName}</td>
                  <td>
                    <code className="entity-id-code">{stopId}</code>
                  </td>
                  <td className="linked-result-actions">
                    <button
                      className="entity-copy-btn"
                      type="button"
                      onClick={() =>
                        onUseValues(
                          "stoppoint-arrivals",
                          { stopPointId: stopId },
                          { execute: true },
                        )
                      }
                    >
                      Arrivals
                    </button>
                    <button
                      className="entity-copy-btn"
                      type="button"
                      onClick={() =>
                        onUseValues("stoppoint-details", { ids: stopId }, { execute: true })
                      }
                    >
                      Details
                    </button>
                    {typeof match.lat === "number" && typeof match.lon === "number" ? (
                      <button
                        className="entity-copy-btn"
                        type="button"
                        onClick={() =>
                          onUseValues(
                            "stoppoint-nearby",
                            {
                              lat: String(match.lat),
                              lon: String(match.lon),
                            },
                            { execute: true },
                          )
                        }
                      >
                        Nearby
                      </button>
                    ) : null}
                    <button
                      className="entity-copy-btn"
                      type="button"
                      onClick={() => copyToClipboard(stopId)}
                    >
                      Copy ID
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotebookLineSearchResults({
  result,
  onUseValues,
}: {
  result: unknown;
  onUseValues: (
    endpointId: string,
    values: Record<string, string>,
    options?: { execute?: boolean },
  ) => void;
}) {
  if (
    !result ||
    typeof result !== "object" ||
    !("matches" in result) ||
    !Array.isArray((result as { matches?: unknown }).matches)
  ) {
    return null;
  }

  const matches = (result as {
    matches: Array<{ id?: string; name?: string }>;
  }).matches.filter((match) => typeof match.id === "string");

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className="linked-result-panel">
      <div className="linked-result-header">
        <strong>Send to line cells</strong>
        <span>Use line IDs directly in metadata, status, and route lookups</span>
      </div>
      <div className="linked-result-table-wrap">
        <table className="linked-result-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {matches.slice(0, 12).map((match) => (
              <tr key={match.id}>
                <td>{match.name ?? match.id}</td>
                <td>
                  <code className="entity-id-code">{match.id}</code>
                </td>
                <td className="linked-result-actions">
                  <button
                    className="entity-copy-btn"
                    type="button"
                    onClick={() =>
                      onUseValues("line-by-id", { ids: match.id ?? "" }, { execute: true })
                    }
                  >
                    Metadata
                  </button>
                  <button
                    className="entity-copy-btn"
                    type="button"
                    onClick={() =>
                      onUseValues("line-status", { ids: match.id ?? "" }, { execute: true })
                    }
                  >
                    Status
                  </button>
                  <button
                    className="entity-copy-btn"
                    type="button"
                    onClick={() =>
                      onUseValues("line-stop-points", { id: match.id ?? "" }, { execute: true })
                    }
                  >
                    Stops
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotebookCell({
  endpoint,
  cellNumber,
  cellState,
  onSetParam,
  onExecute,
  onUseValues,
}: {
  endpoint: ExplorerEndpointDef;
  cellNumber: number;
  cellState: ExplorerCellState;
  onSetParam: (endpointId: string, key: string, value: string) => void;
  onExecute: (endpointId: string) => void;
  onUseValues: (
    endpointId: string,
    values: Record<string, string>,
    options?: { execute?: boolean },
  ) => void;
}) {
  const currentValues = useMemo(
    () => explorerInputValues(endpoint, cellState.paramValues),
    [endpoint, cellState.paramValues],
  );
  const previewUrl = useMemo(
    () => buildPreviewUrl(TFL_API_BASE, endpoint, currentValues),
    [endpoint, currentValues],
  );

  return (
    <div className="notebook-cell-stack" id={`cell-${endpoint.id}`}>
      <section className="notebook-cell">
        <div className="notebook-prompt">
          <span>In [{cellNumber}]</span>
        </div>
        <div className="notebook-cell-body">
          <div className="notebook-cell-head">
            <div>
              <h3 className="notebook-cell-title">{endpoint.label}</h3>
              <p className="notebook-cell-desc">{endpoint.description}</p>
            </div>
            <button
              className="explorer-execute"
              type="button"
              onClick={() => onExecute(endpoint.id)}
              disabled={cellState.loading}
            >
              {cellState.loading ? "Fetching…" : "Run cell"}
            </button>
          </div>

          <div className="explorer-param-grid">
            {endpoint.params.map((param) => (
              <label key={param.key}>
                <span>{param.label}</span>
                <input
                  type={param.type === "number" ? "number" : "text"}
                  placeholder={param.placeholder ?? param.defaultValue}
                  value={currentValues[param.key]}
                  onChange={(e) => onSetParam(endpoint.id, param.key, e.target.value)}
                />
              </label>
            ))}
          </div>

          <div className="explorer-url-bar">
            <span className="explorer-url-method">GET</span>
            <code className="explorer-url-text">{previewUrl}</code>
          </div>

          {cellState.error ? (
            <section className="errors" aria-label="API error">
              <strong>Error</strong>
              <p style={{ margin: "4px 0 0" }}>{cellState.error}</p>
            </section>
          ) : null}

          {endpoint.id === "stoppoint-search" ? (
            <NotebookStopSearchResults result={cellState.result} onUseValues={onUseValues} />
          ) : null}
          {endpoint.id === "line-search" ? (
            <NotebookLineSearchResults result={cellState.result} onUseValues={onUseValues} />
          ) : null}
        </div>
      </section>

      {cellState.result !== undefined ? (
        <section className="notebook-output">
          <div className="notebook-prompt notebook-prompt-out">
            <span>Out[{cellNumber}]</span>
          </div>
          <div className="notebook-output-body">
            {cellState.meta ? (
              <div className="explorer-result-meta">
                <span>{cellState.meta.summary}</span>
                <span>{cellState.meta.ms} ms</span>
                <span>{(cellState.meta.bytes / 1024).toFixed(1)} KB</span>
              </div>
            ) : null}
            <pre
              className="explorer-json"
              dangerouslySetInnerHTML={{ __html: highlightJson(cellState.result) }}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SettingsWorkbench({ provider }: { provider: ProviderWorkbenchDef }) {
  const [apiKeyInput, setApiKeyInput] = useState(() => readStoredApiKey());
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [hasStoredKey, setHasStoredKey] = useState(() => readStoredApiKey().length > 0);

  const usingRuntimeKey = hasStoredKey;
  const effectiveKey = activeApiKey();

  function saveApiKey() {
    writeStoredApiKey(apiKeyInput);
    const storedValue = readStoredApiKey();
    setApiKeyInput(storedValue);
    setHasStoredKey(storedValue.length > 0);
    setSaveMessage(storedValue ? "Saved browser API key." : "Cleared browser API key.");
  }

  function clearApiKey() {
    writeStoredApiKey("");
    setApiKeyInput("");
    setHasStoredKey(false);
    setSaveMessage("Cleared browser API key.");
  }

  return (
    <section className="notebook-section">
      <div className="notebook-section-header">
        <p className="explorer-kicker">Settings</p>
        <h2>{provider.label} API Settings</h2>
        <p>Store a {provider.label} API key in this browser to use it for explorer requests.</p>
      </div>

      <div className="settings-panel">
        <label className="settings-field">
          <span>{provider.label} API key</span>
          <input
            type="password"
            placeholder={`Paste ${provider.label} API key`}
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
        </label>

        <div className="settings-actions">
          <button className="explorer-execute" type="button" onClick={saveApiKey}>
            Save key
          </button>
          <button className="entity-copy-btn" type="button" onClick={clearApiKey}>
            Clear
          </button>
        </div>

        {saveMessage ? <div className="save-message">{saveMessage}</div> : null}

        <div className="settings-meta">
          <span>{usingRuntimeKey ? "Using browser-stored key" : "Using build-time key"}</span>
          <span>{effectiveKey ? `Key present (${effectiveKey.length} chars)` : "No API key set"}</span>
        </div>
      </div>
    </section>
  );
}

export default function ExplorerPage({ HeaderBar }: ExplorerPageProps) {
  const provider = TFL_PROVIDER;
  const [selectedSectionId, setSelectedSectionId] = useState<string>(provider.sections[0].id);
  const [cellStates, setCellStates] = useState<Record<string, ExplorerCellState>>(() =>
    Object.fromEntries(
      EXPLORER_ENDPOINTS.map((endpoint) => [endpoint.id, initialExplorerCellState()]),
    ) as Record<string, ExplorerCellState>,
  );
  const selectedSection =
    provider.sections.find((section) => section.id === selectedSectionId) ??
    provider.sections[0];

  function setParam(endpointId: string, key: string, value: string) {
    setCellStates((current) => ({
      ...current,
      [endpointId]: {
        ...current[endpointId],
        paramValues: {
          ...current[endpointId].paramValues,
          [key]: value,
        },
      },
    }));
  }

  function getCellValues(endpointId: string, overrideValues?: Record<string, string>) {
    const endpoint = EXPLORER_ENDPOINT_BY_ID[endpointId];
    const state = cellStates[endpointId] ?? initialExplorerCellState();
    return explorerInputValues(endpoint, {
      ...state.paramValues,
      ...(overrideValues ?? {}),
    });
  }

  async function executeEndpoint(endpointId: string, overrideValues?: Record<string, string>) {
    const endpoint = EXPLORER_ENDPOINT_BY_ID[endpointId];
    if (!endpoint) {
      return;
    }

    const currentValues = getCellValues(endpointId, overrideValues);
    setCellStates((current) => ({
      ...current,
      [endpointId]: {
        ...current[endpointId],
        paramValues: {
          ...current[endpointId].paramValues,
          ...(overrideValues ?? {}),
        },
        loading: true,
        result: undefined,
        error: null,
        meta: null,
      },
    }));

    const t0 = Date.now();
    const { path, params } = endpoint.buildPath(currentValues);
    try {
      const data = await getJson<unknown>(path, params);
      const elapsed = Date.now() - t0;
      setCellStates((current) => ({
        ...current,
        [endpointId]: {
          ...current[endpointId],
          loading: false,
          result: data,
          error: null,
          meta: {
            ms: elapsed,
            summary: explorerResultSummary(data),
            bytes: JSON.stringify(data).length,
          },
        },
      }));
    } catch (caught) {
      setCellStates((current) => ({
        ...current,
        [endpointId]: {
          ...current[endpointId],
          loading: false,
          error: caught instanceof Error ? caught.message : String(caught),
          meta: {
            ms: Date.now() - t0,
            summary: "",
            bytes: 0,
          },
        },
      }));
    }
  }

  function applyCellValues(
    endpointId: string,
    values: Record<string, string>,
    options?: { execute?: boolean },
  ) {
    setCellStates((current) => ({
      ...current,
      [endpointId]: {
        ...current[endpointId],
        paramValues: {
          ...current[endpointId].paramValues,
          ...values,
        },
      },
    }));
    scrollToExplorerCell(endpointId);
    if (options?.execute) {
      void executeEndpoint(endpointId, values);
    }
  }

  return (
    <>
      {HeaderBar({ currentPage: "explorer" })}
      <main className="explorer-notebook-page">
        <div className="explorer-workbench-layout">
          <aside className="explorer-workbench-sidebar" aria-label="Workbench sections">
            <p className="explorer-sidebar-title">Workbenches</p>
            <div className="explorer-sidebar-group">
              <p className="explorer-sidebar-group-label">{provider.label}</p>
              <div className="explorer-sidebar-list">
                {provider.sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className={`explorer-sidebar-item${
                      selectedSectionId === section.id ? " explorer-sidebar-item--active" : ""
                    }`}
                    onClick={() => setSelectedSectionId(section.id)}
                  >
                    <strong>{section.label}</strong>
                    <span>{section.description}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className={`explorer-sidebar-item${
                    selectedSectionId === "reference-ids" ? " explorer-sidebar-item--active" : ""
                  }`}
                  onClick={() => setSelectedSectionId("reference-ids")}
                >
                  <strong>{provider.referenceLabel}</strong>
                  <span>{provider.referenceDescription}</span>
                </button>
                <button
                  type="button"
                  className={`explorer-sidebar-item${
                    selectedSectionId === "settings" ? " explorer-sidebar-item--active" : ""
                  }`}
                  onClick={() => setSelectedSectionId("settings")}
                >
                  <strong>{provider.settingsLabel}</strong>
                  <span>{provider.settingsDescription}</span>
                </button>
              </div>
            </div>
          </aside>

          <div className="explorer-notebook">
            {selectedSectionId === "settings" ? (
              <SettingsWorkbench provider={provider} />
            ) : selectedSectionId === "reference-ids" ? (
              <section id="reference-ids" className="notebook-section">
                <div className="notebook-section-header">
                  <p className="explorer-kicker">{provider.label} Reference</p>
                  <h2>{provider.label} reference IDs</h2>
                  <p>
                    Static and searchable ID lists for common {provider.label} stop, line, and
                    mode values.
                  </p>
                </div>
                <div className="reference-grid">
                  {provider.referenceEntities.map((entity) => (
                    <ReferenceCard key={entity.id} entity={entity} />
                  ))}
                </div>
              </section>
            ) : (
              <section key={selectedSection.id} id={selectedSection.id} className="notebook-section">
                <div className="notebook-section-header">
                  <p className="explorer-kicker">{provider.label} Workbench</p>
                  <h2>{selectedSection.label}</h2>
                  <p>{selectedSection.description}</p>
                </div>
                <div className="notebook-stack">
                  {selectedSection.endpointIds.map((endpointId, index) => {
                    const endpoint = EXPLORER_ENDPOINT_BY_ID[endpointId];
                    if (!endpoint) {
                      return null;
                    }
                    return (
                      <NotebookCell
                        key={endpoint.id}
                        endpoint={endpoint}
                        cellNumber={index + 1}
                        cellState={cellStates[endpoint.id]}
                        onSetParam={setParam}
                        onExecute={(id) => {
                          void executeEndpoint(id);
                        }}
                        onUseValues={applyCellValues}
                      />
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
