import { useCallback, useEffect, useMemo, useState } from "react";
import { activeApiKey, getJson, readStoredApiKey, writeStoredApiKey } from "./tfl/client";
import {
  collectBusStops,
  fetchDepartures,
  filterDeparturesByLines,
} from "./tfl/departures";
import type { BusStop, Departure, GeoLocation } from "./tfl/types";

const DEFAULT_QUERY = "London Bridge Station";
const DEFAULT_RADIUS_METRES = 250;
const INDEX_LINES = ["149", "388"];
const SAVED_SEARCHES_KEY = "commute.savedSearches.v1";
const LINE_COLOURS: Record<string, { background: string; color: string }> = {
  bakerloo: { background: "#B36305", color: "#fff" },
  central: { background: "#E32017", color: "#fff" },
  circle: { background: "#FFD300", color: "#17202a" },
  district: { background: "#00782A", color: "#fff" },
  "hammersmith & city": { background: "#F3A9BB", color: "#17202a" },
  jubilee: { background: "#A0A5A9", color: "#17202a" },
  metropolitan: { background: "#9B0056", color: "#fff" },
  northern: { background: "#000000", color: "#fff" },
  piccadilly: { background: "#003688", color: "#fff" },
  victoria: { background: "#0098D4", color: "#fff" },
  "waterloo & city": { background: "#95CDBA", color: "#17202a" },
};

type LoadState = {
  stops: BusStop[];
  departures: Departure[];
  errors: string[];
  inferredLocation: GeoLocation | null;
};

type SavedSearch = {
  id: string;
  query: string;
  lines: string[];
  radius: number;
  limit: number;
};

const emptyLoadState: LoadState = {
  stops: [],
  departures: [],
  errors: [],
  inferredLocation: null,
};

const defaultSavedSearch: SavedSearch = {
  id: "default-london-bridge-149-388",
  query: DEFAULT_QUERY,
  lines: INDEX_LINES,
  radius: DEFAULT_RADIUS_METRES,
  limit: 5,
};

function formatDue(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  return minutes === 0 ? "due" : `${minutes} min`;
}

function formatClock(seconds: number): string {
  const due = new Date(Date.now() + seconds * 1000);
  return due.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseLines(value: string): string[] {
  return value
    .split(",")
    .map((line) => line.trim())
    .filter(Boolean);
}

function savedSearchTitle(search: SavedSearch): string {
  const lines = search.lines.length > 0 ? ` ${search.lines.join(", ")}` : "";
  return `${search.query}${lines}`;
}

function readSavedSearches(): SavedSearch[] {
  try {
    const raw = window.localStorage.getItem(SAVED_SEARCHES_KEY);
    if (!raw) {
      return [defaultSavedSearch];
    }

    const parsed = JSON.parse(raw) as SavedSearch[];
    return parsed.length > 0 ? parsed : [defaultSavedSearch];
  } catch {
    return [defaultSavedSearch];
  }
}

function writeSavedSearches(searches: SavedSearch[]) {
  window.localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(searches));
}

function makeSavedSearch(query: string, lineFilter: string, radius: number, limit: number) {
  const lines = parseLines(lineFilter);
  return {
    id: `${query.toLowerCase()}|${lines.join(",").toLowerCase()}|${radius}|${limit}`,
    query,
    lines,
    radius,
    limit,
  };
}

function lineBadgeStyle(lineName: string): React.CSSProperties {
  const colours = LINE_COLOURS[lineName.toLowerCase()];
  if (!colours) {
    return {};
  }

  return {
    "--line-background": colours.background,
    "--line-color": colours.color,
  } as React.CSSProperties;
}

function lineBadgeClassName(lineName: string): string {
  const slug = lineName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `route-badge route-badge-${slug}`;
}

async function loadDepartures(query: string, radius: number): Promise<LoadState> {
  const stopsResult = await collectBusStops({
    query,
    maxStops: 25,
    radius,
  });
  const departuresResult = await fetchDepartures(stopsResult.stops);

  return {
    stops: stopsResult.stops,
    departures: departuresResult.departures,
    errors: departuresResult.errors,
    inferredLocation: stopsResult.inferredLocation,
  };
}

function ErrorPanel({ errors }: { errors: string[] }) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <section className="errors" aria-label="API errors">
      <strong>API errors</strong>
      <ul>
        {errors.map((message, index) => (
          <li key={`${message}-${index}`}>{message}</li>
        ))}
      </ul>
    </section>
  );
}

function DepartureTable({
  departures,
  errors,
  loading,
}: {
  departures: Departure[];
  errors: string[];
  loading: boolean;
}) {
  return (
    <section className="departures" aria-label="Live departures">
      <div className="table-header">
        <span>Time</span>
        <span>Route</span>
        <span>Destination</span>
        <span>Stop</span>
      </div>
      {loading ? (
        <div className="loading-state" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Loading live TfL departures</span>
        </div>
      ) : null}
      {departures.length === 0 && !loading && errors.length === 0 ? (
        <div className="empty">No live bus departures returned by TfL right now.</div>
      ) : null}
      {departures.map((departure, index) => (
        <div
          className="departure-row"
          key={`${departure.prediction.id ?? "prediction"}-${index}`}
        >
          <span className="time-cell">
            {formatDue(departure.prediction.timeToStation)}
            <small>{formatClock(departure.prediction.timeToStation)}</small>
          </span>
          <strong
            className={lineBadgeClassName(departure.prediction.lineName)}
            style={lineBadgeStyle(departure.prediction.lineName)}
          >
            {departure.prediction.lineName}
          </strong>
          <span>{departure.prediction.destinationName ?? "Unknown destination"}</span>
          <span>{departure.stopName}</span>
        </div>
      ))}
    </section>
  );
}

function HeaderBar({
  currentPage,
  extraAction,
}: {
  currentPage: "home" | "search" | "explorer";
  extraAction?: React.ReactNode;
}) {
  function refreshPage() {
    window.location.reload();
  }

  return (
    <header className="app-header">
      <a className="brand-link" href="./index.html">
        Commute
      </a>
      <nav aria-label="Primary navigation">
        <button className="header-action" type="button" onClick={refreshPage}>
          Refresh
        </button>
        {extraAction}
        {currentPage !== "home" ? <a href="#">Home</a> : null}
        {currentPage !== "search" ? <a href="#search">Search</a> : null}
        {currentPage !== "explorer" ? <a href="#explorer">Explorer</a> : null}
      </nav>
    </header>
  );
}

function SearchPage() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [lineFilter, setLineFilter] = useState("");
  const [radius, setRadius] = useState(DEFAULT_RADIUS_METRES);
  const [limit, setLimit] = useState(20);
  const [loadState, setLoadState] = useState<LoadState>(emptyLoadState);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const selectedLines = useMemo(() => parseLines(lineFilter), [lineFilter]);
  const visibleDepartures = useMemo(
    () =>
      filterDeparturesByLines(loadState.departures, selectedLines).slice(0, limit),
    [loadState.departures, limit, selectedLines],
  );
  const mappedStops = useMemo(
    () => loadState.stops.filter((stop) => stop.location !== null),
    [loadState.stops],
  );

  const refresh = useCallback(async (nextQuery: string, nextRadius: number) => {
    setLoading(true);
    setLoadState((current) => ({ ...current, errors: [] }));
    try {
      setLoadState(await loadDepartures(nextQuery, nextRadius));
    } catch (caught) {
      setLoadState({
        ...emptyLoadState,
        errors: [
          caught instanceof Error ? caught.message : "Could not load TfL departures.",
        ],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(DEFAULT_QUERY, DEFAULT_RADIUS_METRES);
  }, [refresh]);

  function saveCurrentSearch() {
    const search = makeSavedSearch(query, lineFilter, radius, limit);
    const existing = readSavedSearches();
    const next = [
      search,
      ...existing.filter((savedSearch) => savedSearch.id !== search.id),
    ];
    writeSavedSearches(next);
    setSaveMessage(`Saved ${savedSearchTitle(search)}`);
  }

  return (
    <>
      <HeaderBar currentPage="search" />
      <main className="app-shell">
        <section className="page-intro">
          <p className="page-kicker">Commute</p>
          <h1>Search</h1>
        </section>
        <section className="controls" aria-label="Departure controls">
          <div className="control-grid">
            <label>
              Stop search
              <input value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label>
              Routes
              <input
                placeholder="149, 381"
                value={lineFilter}
                onChange={(event) => setLineFilter(event.target.value)}
              />
            </label>
            <label>
              Radius (m)
              <input
                min={100}
                max={800}
                step={50}
                type="number"
                value={radius}
                onChange={(event) => setRadius(Number(event.target.value))}
              />
            </label>
            <label>
              Limit
              <input
                min={1}
                max={80}
                type="number"
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              onClick={() => void refresh(query, radius)}
              disabled={loading}
            >
              {loading ? "Updating" : "Refresh"}
            </button>
            <button type="button" onClick={saveCurrentSearch}>
              Save
            </button>
          </div>
        </section>

        {saveMessage ? <div className="save-message">{saveMessage}</div> : null}

        <ErrorPanel errors={loadState.errors} />

        <section className="map-panel">
          <div className="action-row">
            <div className="summary" aria-label="Checked stops">
              <span>{loadState.stops.length} stops checked</span>
            </div>
            <button
              className="map-toggle"
              type="button"
              onClick={() => setShowMap((current) => !current)}
              aria-expanded={showMap}
            >
              {showMap ? "Hide location" : "Show location"}
            </button>
          </div>
          {showMap ? (
            loadState.inferredLocation ? (
              <div className="map-content">
                <div className="map-meta">
                  Inferred from TfL search: {loadState.inferredLocation.lat.toFixed(5)},{" "}
                  {loadState.inferredLocation.lon.toFixed(5)}. Showing{" "}
                  {mappedStops.length} stop{mappedStops.length === 1 ? "" : "s"} with
                  coordinates.
                </div>
                <iframe
                  title="Inferred station location"
                  src={`https://www.google.com/maps?q=${loadState.inferredLocation.lat},${loadState.inferredLocation.lon}&z=16&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : (
              <div className="map-empty">No inferred location available.</div>
            )
          ) : null}
        </section>

        <DepartureTable
          departures={visibleDepartures}
          errors={loadState.errors}
          loading={loading}
        />
      </main>
    </>
  );
}

function IndexPage() {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(() =>
    readSavedSearches(),
  );
  const [loadStates, setLoadStates] = useState<Record<string, LoadState>>({});
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const entries = await Promise.all(
      savedSearches.map(async (search) => {
        try {
          return [search.id, await loadDepartures(search.query, search.radius)] as const;
        } catch (caught) {
          return [
            search.id,
            {
              ...emptyLoadState,
              errors: [
                caught instanceof Error
                  ? caught.message
                  : "Could not load TfL departures.",
              ],
            },
          ] as const;
        }
      }),
    );
    setLoadStates(Object.fromEntries(entries));
    setLoading(false);
  }, [savedSearches]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function removeSearch(searchId: string) {
    const next = savedSearches.filter((search) => search.id !== searchId);
    setSavedSearches(next);
    writeSavedSearches(next);
    setLoadStates((current) => {
      const copy = { ...current };
      delete copy[searchId];
      return copy;
    });
  }

  function moveSearch(searchId: string, direction: -1 | 1) {
    const index = savedSearches.findIndex((search) => search.id === searchId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= savedSearches.length) {
      return;
    }

    const next = [...savedSearches];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setSavedSearches(next);
    writeSavedSearches(next);
  }

  return (
    <>
      <HeaderBar
        currentPage="home"
        extraAction={
          <button
            className="header-action"
            type="button"
            onClick={() => setEditMode((current) => !current)}
          >
            {editMode ? "Done" : "Edit"}
          </button>
        }
      />
      <main className="app-shell static-page">
        <section className="page-intro">
          <p className="page-kicker">Commute</p>
          <h1>Saved searches</h1>
        </section>
        {savedSearches.map((search) => {
          const loadState = loadStates[search.id] ?? emptyLoadState;
          const visibleDepartures = filterDeparturesByLines(
            loadState.departures,
            search.lines,
          ).slice(0, 5);

          return (
            <section className="saved-search" key={search.id}>
              <div className="saved-search-header">
                <div>
                  <h2>{savedSearchTitle(search)}</h2>
                </div>
                {editMode ? (
                  <div className="edit-actions">
                    <button
                      className="reorder-search"
                      type="button"
                      onClick={() => moveSearch(search.id, -1)}
                      disabled={savedSearches.indexOf(search) === 0}
                    >
                      Up
                    </button>
                    <button
                      className="reorder-search"
                      type="button"
                      onClick={() => moveSearch(search.id, 1)}
                      disabled={savedSearches.indexOf(search) === savedSearches.length - 1}
                    >
                      Down
                    </button>
                    <button
                      className="remove-search"
                      type="button"
                      onClick={() => removeSearch(search.id)}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
              <ErrorPanel errors={loadState.errors} />
              <DepartureTable
                departures={visibleDepartures}
                errors={loadState.errors}
                loading={loading}
              />
            </section>
          );
        })}
      </main>
    </>
  );
}

// ---- API Explorer ----

type ExplorerParamDef = {
  key: string;
  label: string;
  placeholder?: string;
  defaultValue: string;
  type?: "text" | "number";
};

type ExplorerEndpointDef = {
  id: string;
  label: string;
  description: string;
  params: ExplorerParamDef[];
  buildPath: (values: Record<string, string>) => {
    path: string;
    params?: Record<string, string | number | boolean | string[] | undefined>;
  };
};

type ExplorerEndpointGroup = {
  label: string;
  endpoints: ExplorerEndpointDef[];
};

const EXPLORER_ENDPOINT_GROUPS: ExplorerEndpointGroup[] = [
  {
    label: "StopPoint",
    endpoints: [
      {
        id: "stoppoint-search",
        label: "Search",
        description: "GET /StopPoint/Search/{query} — Text search for stops and stations",
        params: [
          { key: "query", label: "Query", placeholder: "London Bridge Station", defaultValue: "London Bridge Station" },
          { key: "modes", label: "Modes", placeholder: "bus,tube", defaultValue: "bus" },
          { key: "maxResults", label: "Max results", defaultValue: "20", type: "number" },
        ],
        buildPath: (v) => ({
          path: `/StopPoint/Search/${encodeURIComponent(v.query ?? "")}`,
          params: {
            modes:
              (v.modes ?? "bus")
                .split(",")
                .map((m) => m.trim())
                .filter(Boolean)
                .join(",") || undefined,
            maxResults: Number(v.maxResults ?? 20),
            includeHubs: true,
          },
        }),
      },
      {
        id: "stoppoint-nearby",
        label: "Nearby",
        description: "GET /StopPoint — Stop points within a radius of coordinates",
        params: [
          { key: "lat", label: "Latitude", defaultValue: "51.5045" },
          { key: "lon", label: "Longitude", defaultValue: "-0.0865" },
          { key: "radius", label: "Radius (m)", defaultValue: "250", type: "number" },
          { key: "modes", label: "Modes", defaultValue: "bus" },
          { key: "stopTypes", label: "Stop types", defaultValue: "NaptanPublicBusCoachTram" },
        ],
        buildPath: (v) => ({
          path: "/StopPoint",
          params: {
            lat: Number(v.lat),
            lon: Number(v.lon),
            radius: Number(v.radius ?? 250),
            modes: v.modes ?? "bus",
            stopTypes: v.stopTypes ?? "NaptanPublicBusCoachTram",
          },
        }),
      },
      {
        id: "stoppoint-arrivals",
        label: "Arrivals",
        description: "GET /StopPoint/{id}/Arrivals — Live arrival predictions for a stop",
        params: [
          { key: "stopPointId", label: "Stop ID", defaultValue: "490000139R" },
        ],
        buildPath: (v) => ({
          path: `/StopPoint/${encodeURIComponent(v.stopPointId ?? "")}/Arrivals`,
        }),
      },
      {
        id: "stoppoint-details",
        label: "Details",
        description: "GET /StopPoint/{ids} — Full stop metadata including child stops",
        params: [
          { key: "ids", label: "Stop ID(s)", defaultValue: "940GZZLULNB" },
        ],
        buildPath: (v) => ({
          path: `/StopPoint/${v.ids ?? "940GZZLULNB"}`,
        }),
      },
      {
        id: "stoppoint-disruption",
        label: "Disruption",
        description: "GET /StopPoint/{ids}/Disruption — Disruptions affecting a stop",
        params: [
          { key: "ids", label: "Stop ID(s)", defaultValue: "940GZZLULNB" },
        ],
        buildPath: (v) => ({
          path: `/StopPoint/${v.ids ?? "940GZZLULNB"}/Disruption`,
        }),
      },
      {
        id: "stoppoint-disruption-by-mode",
        label: "Disruption by Mode",
        description: "GET /StopPoint/Mode/{modes}/Disruption — Disrupted stops for a transport mode",
        params: [
          { key: "modes", label: "Modes", defaultValue: "tube" },
        ],
        buildPath: (v) => ({
          path: `/StopPoint/Mode/${encodeURIComponent(v.modes ?? "tube")}/Disruption`,
        }),
      },
      {
        id: "stoppoint-route",
        label: "Route",
        description: "GET /StopPoint/{id}/Route — Route sections through a stop",
        params: [
          { key: "id", label: "Stop ID", defaultValue: "940GZZLULNB" },
        ],
        buildPath: (v) => ({
          path: `/StopPoint/${encodeURIComponent(v.id ?? "940GZZLULNB")}/Route`,
        }),
      },
      {
        id: "stoppoint-direction-to",
        label: "Direction To",
        description: "GET /StopPoint/{id}/DirectionTo/{toStopPointId} — Inbound or outbound between two stops",
        params: [
          { key: "id", label: "From stop", defaultValue: "940GZZLULNB" },
          { key: "toStopPointId", label: "To stop", defaultValue: "940GZZLUWLO" },
        ],
        buildPath: (v) => ({
          path: `/StopPoint/${encodeURIComponent(v.id ?? "")}/DirectionTo/${encodeURIComponent(v.toStopPointId ?? "")}`,
        }),
      },
      {
        id: "stoppoint-by-mode",
        label: "By Mode",
        description: "GET /StopPoint/Mode/{modes} — All stop points for a transport mode (paginated)",
        params: [
          { key: "modes", label: "Modes", defaultValue: "tube" },
          { key: "page", label: "Page", defaultValue: "1", type: "number" },
        ],
        buildPath: (v) => ({
          path: `/StopPoint/Mode/${encodeURIComponent(v.modes ?? "tube")}`,
          params: { page: Number(v.page ?? 1) },
        }),
      },
      {
        id: "stoppoint-by-type",
        label: "By Type",
        description: "GET /StopPoint/Type/{types} — Stop points filtered by stop type",
        params: [
          { key: "types", label: "Stop types", defaultValue: "NaptanMetroStation" },
        ],
        buildPath: (v) => ({
          path: `/StopPoint/Type/${encodeURIComponent(v.types ?? "NaptanMetroStation")}`,
        }),
      },
      {
        id: "stoppoint-car-parks",
        label: "Car Parks",
        description: "GET /StopPoint/{stopPointId}/CarParks — Car parks near a stop",
        params: [
          { key: "stopPointId", label: "Stop ID", defaultValue: "940GZZLULNB" },
        ],
        buildPath: (v) => ({
          path: `/StopPoint/${encodeURIComponent(v.stopPointId ?? "")}/CarParks`,
        }),
      },
      {
        id: "stoppoint-meta-modes",
        label: "Meta / Modes",
        description: "GET /StopPoint/Meta/Modes — All modes that have stop point data",
        params: [],
        buildPath: () => ({ path: "/StopPoint/Meta/Modes" }),
      },
      {
        id: "stoppoint-meta-stoptypes",
        label: "Meta / Stop Types",
        description: "GET /StopPoint/Meta/StopTypes — Valid stop type identifiers",
        params: [],
        buildPath: () => ({ path: "/StopPoint/Meta/StopTypes" }),
      },
    ],
  },
  {
    label: "Line",
    endpoints: [
      {
        id: "line-by-id",
        label: "By ID",
        description: "GET /Line/{ids} — Line metadata for one or more lines",
        params: [
          { key: "ids", label: "Line ID(s)", placeholder: "jubilee,northern", defaultValue: "jubilee" },
        ],
        buildPath: (v) => ({ path: `/Line/${v.ids ?? "jubilee"}` }),
      },
      {
        id: "line-by-mode",
        label: "By Mode",
        description: "GET /Line/Mode/{modes} — All lines for a transport mode",
        params: [
          { key: "modes", label: "Modes", defaultValue: "tube" },
        ],
        buildPath: (v) => ({ path: `/Line/Mode/${encodeURIComponent(v.modes ?? "tube")}` }),
      },
      {
        id: "line-search",
        label: "Search",
        description: "GET /Line/Search/{query} — Search for lines by name or number",
        params: [
          { key: "query", label: "Query", defaultValue: "jubilee" },
          { key: "modes", label: "Modes", placeholder: "tube,bus (optional)", defaultValue: "" },
        ],
        buildPath: (v) => ({
          path: `/Line/Search/${encodeURIComponent(v.query ?? "")}`,
          params: { modes: v.modes || undefined },
        }),
      },
      {
        id: "line-status",
        label: "Status by ID",
        description: "GET /Line/{ids}/Status — Current service status for one or more lines",
        params: [
          { key: "ids", label: "Line ID(s)", placeholder: "jubilee,northern", defaultValue: "jubilee,northern" },
          { key: "detail", label: "Detail", placeholder: "true/false", defaultValue: "false" },
        ],
        buildPath: (v) => ({
          path: `/Line/${v.ids ?? "jubilee"}/Status`,
          params: { detail: v.detail === "true" },
        }),
      },
      {
        id: "line-status-by-mode",
        label: "Status by Mode",
        description: "GET /Line/Mode/{modes}/Status — Service status for all lines of a mode",
        params: [
          { key: "modes", label: "Modes", defaultValue: "tube" },
          { key: "detail", label: "Detail", placeholder: "true/false", defaultValue: "false" },
        ],
        buildPath: (v) => ({
          path: `/Line/Mode/${encodeURIComponent(v.modes ?? "tube")}/Status`,
          params: { detail: v.detail === "true" },
        }),
      },
      {
        id: "line-route",
        label: "Route",
        description: "GET /Line/{ids}/Route — Route information for a line",
        params: [
          { key: "ids", label: "Line ID(s)", defaultValue: "149" },
        ],
        buildPath: (v) => ({ path: `/Line/${v.ids ?? "149"}/Route` }),
      },
      {
        id: "line-route-sequence",
        label: "Route Sequence",
        description: "GET /Line/{id}/Route/Sequence/{direction} — Ordered stops along a route",
        params: [
          { key: "id", label: "Line ID", defaultValue: "northern" },
          { key: "direction", label: "Direction", placeholder: "inbound,outbound", defaultValue: "inbound" },
        ],
        buildPath: (v) => ({
          path: `/Line/${encodeURIComponent(v.id ?? "northern")}/Route/Sequence/${encodeURIComponent(v.direction ?? "inbound")}`,
        }),
      },
      {
        id: "line-arrivals-at-stop",
        label: "Arrivals at Stop",
        description: "GET /Line/{ids}/Arrivals/{stopPointId} — Arrivals for a line at a specific stop",
        params: [
          { key: "ids", label: "Line ID(s)", defaultValue: "149" },
          { key: "stopPointId", label: "Stop ID", defaultValue: "490000139R" },
        ],
        buildPath: (v) => ({
          path: `/Line/${v.ids ?? "149"}/Arrivals/${encodeURIComponent(v.stopPointId ?? "490000139R")}`,
        }),
      },
      {
        id: "line-disruption",
        label: "Disruption by ID",
        description: "GET /Line/{ids}/Disruption — Disruptions on one or more lines",
        params: [
          { key: "ids", label: "Line ID(s)", defaultValue: "jubilee" },
        ],
        buildPath: (v) => ({ path: `/Line/${v.ids ?? "jubilee"}/Disruption` }),
      },
      {
        id: "line-disruption-by-mode",
        label: "Disruption by Mode",
        description: "GET /Line/Mode/{modes}/Disruption — Disruptions for all lines of a mode",
        params: [
          { key: "modes", label: "Modes", defaultValue: "tube" },
        ],
        buildPath: (v) => ({ path: `/Line/Mode/${encodeURIComponent(v.modes ?? "tube")}/Disruption` }),
      },
      {
        id: "line-stop-points",
        label: "Stop Points",
        description: "GET /Line/{id}/StopPoints — All stops served by a line",
        params: [
          { key: "id", label: "Line ID", defaultValue: "jubilee" },
        ],
        buildPath: (v) => ({ path: `/Line/${encodeURIComponent(v.id ?? "jubilee")}/StopPoints` }),
      },
      {
        id: "line-timetable",
        label: "Timetable",
        description: "GET /Line/{id}/Timetable/{fromStopPointId} — Timetable from a stop on a line",
        params: [
          { key: "id", label: "Line ID", defaultValue: "northern" },
          { key: "fromStopPointId", label: "From stop ID", defaultValue: "940GZZLULNB" },
        ],
        buildPath: (v) => ({
          path: `/Line/${encodeURIComponent(v.id ?? "northern")}/Timetable/${encodeURIComponent(v.fromStopPointId ?? "940GZZLULNB")}`,
        }),
      },
      {
        id: "line-meta-modes",
        label: "Meta / Modes",
        description: "GET /Line/Meta/Modes — All modes that have line data",
        params: [],
        buildPath: () => ({ path: "/Line/Meta/Modes" }),
      },
      {
        id: "line-meta-severity",
        label: "Meta / Severity",
        description: "GET /Line/Meta/Severity — Severity level codes and descriptions",
        params: [],
        buildPath: () => ({ path: "/Line/Meta/Severity" }),
      },
      {
        id: "line-meta-disruption-categories",
        label: "Meta / Disruption Categories",
        description: "GET /Line/Meta/DisruptionCategories — Disruption category identifiers",
        params: [],
        buildPath: () => ({ path: "/Line/Meta/DisruptionCategories" }),
      },
    ],
  },
  {
    label: "Journey",
    endpoints: [
      {
        id: "journey-results",
        label: "Journey Results",
        description: "GET /Journey/JourneyResults/{from}/to/{to} — Plan a journey between two places",
        params: [
          { key: "from", label: "From", placeholder: "940GZZLULNB", defaultValue: "940GZZLULNB" },
          { key: "to", label: "To", placeholder: "940GZZLUVIC", defaultValue: "940GZZLUVIC" },
          { key: "mode", label: "Modes", placeholder: "tube,bus (optional)", defaultValue: "" },
          { key: "time", label: "Time (HHmm)", placeholder: "0830 (optional)", defaultValue: "" },
          { key: "timeIs", label: "Time is", placeholder: "Departing/Arriving", defaultValue: "" },
        ],
        buildPath: (v) => ({
          path: `/Journey/JourneyResults/${encodeURIComponent(v.from ?? "")}/to/${encodeURIComponent(v.to ?? "")}`,
          params: {
            mode: v.mode || undefined,
            time: v.time || undefined,
            timeIs: v.timeIs || undefined,
          },
        }),
      },
      {
        id: "journey-meta-modes",
        label: "Meta / Modes",
        description: "GET /Journey/Meta/Modes — Transport modes available for journey planning",
        params: [],
        buildPath: () => ({ path: "/Journey/Meta/Modes" }),
      },
    ],
  },
  {
    label: "Mode",
    endpoints: [
      {
        id: "mode-arrivals",
        label: "Arrivals",
        description: "GET /Mode/{mode}/Arrivals — Next arrivals across all stops for a mode",
        params: [
          { key: "mode", label: "Mode", defaultValue: "tube" },
          { key: "count", label: "Count", defaultValue: "10", type: "number" },
        ],
        buildPath: (v) => ({
          path: `/Mode/${encodeURIComponent(v.mode ?? "tube")}/Arrivals`,
          params: { count: Number(v.count ?? 10) },
        }),
      },
      {
        id: "mode-active-service-types",
        label: "Active Service Types",
        description: "GET /Mode/ActiveServiceTypes — Currently active transport modes and service types",
        params: [],
        buildPath: () => ({ path: "/Mode/ActiveServiceTypes" }),
      },
    ],
  },
  {
    label: "Vehicle",
    endpoints: [
      {
        id: "vehicle-arrivals",
        label: "Arrivals",
        description: "GET /Vehicle/{ids}/Arrivals — Arrival predictions for a specific vehicle",
        params: [
          { key: "ids", label: "Vehicle ID(s)", placeholder: "LTZ1001", defaultValue: "LTZ1001" },
        ],
        buildPath: (v) => ({ path: `/Vehicle/${v.ids ?? "LTZ1001"}/Arrivals` }),
      },
    ],
  },
  {
    label: "BikePoint",
    endpoints: [
      {
        id: "bikepoint-all",
        label: "All BikePoints",
        description: "GET /BikePoint — All Santander Cycles docking stations with availability",
        params: [],
        buildPath: () => ({ path: "/BikePoint" }),
      },
      {
        id: "bikepoint-by-id",
        label: "By ID",
        description: "GET /BikePoint/{id} — Details and bike availability for a docking station",
        params: [
          { key: "id", label: "BikePoint ID", defaultValue: "BikePoints_1" },
        ],
        buildPath: (v) => ({ path: `/BikePoint/${encodeURIComponent(v.id ?? "BikePoints_1")}` }),
      },
      {
        id: "bikepoint-search",
        label: "Search",
        description: "GET /BikePoint/Search — Search for docking stations by name",
        params: [
          { key: "query", label: "Query", defaultValue: "London Bridge" },
        ],
        buildPath: (v) => ({
          path: "/BikePoint/Search",
          params: { query: v.query ?? "London Bridge" },
        }),
      },
    ],
  },
  {
    label: "Road",
    endpoints: [
      {
        id: "road-all",
        label: "All Roads",
        description: "GET /Road — All TfL-managed road corridors",
        params: [],
        buildPath: () => ({ path: "/Road" }),
      },
      {
        id: "road-by-id",
        label: "By ID",
        description: "GET /Road/{ids} — Road corridor metadata",
        params: [
          { key: "ids", label: "Road ID(s)", placeholder: "A2,A3", defaultValue: "A2" },
        ],
        buildPath: (v) => ({ path: `/Road/${v.ids ?? "A2"}` }),
      },
      {
        id: "road-status",
        label: "Status",
        description: "GET /Road/{ids}/Status — Current traffic status for road corridors",
        params: [
          { key: "ids", label: "Road ID(s)", defaultValue: "A2" },
        ],
        buildPath: (v) => ({ path: `/Road/${v.ids ?? "A2"}/Status` }),
      },
      {
        id: "road-disruption",
        label: "Disruption",
        description: "GET /Road/{ids}/Disruption — Active disruptions on road corridors",
        params: [
          { key: "ids", label: "Road ID(s)", defaultValue: "A2" },
        ],
        buildPath: (v) => ({ path: `/Road/${v.ids ?? "A2"}/Disruption` }),
      },
      {
        id: "road-meta-severities",
        label: "Meta / Severities",
        description: "GET /Road/Meta/Severities — Road disruption severity codes",
        params: [],
        buildPath: () => ({ path: "/Road/Meta/Severities" }),
      },
      {
        id: "road-meta-categories",
        label: "Meta / Categories",
        description: "GET /Road/Meta/Categories — Road disruption category identifiers",
        params: [],
        buildPath: () => ({ path: "/Road/Meta/Categories" }),
      },
    ],
  },
  {
    label: "Occupancy",
    endpoints: [
      {
        id: "occupancy-bike-points",
        label: "Bike Point Availability",
        description: "GET /Occupancy/BikePoints/{ids} — Bike availability at docking stations",
        params: [
          { key: "ids", label: "BikePoint ID(s)", defaultValue: "BikePoints_1" },
        ],
        buildPath: (v) => ({ path: `/Occupancy/BikePoints/${v.ids ?? "BikePoints_1"}` }),
      },
      {
        id: "occupancy-charge-connector",
        label: "EV Charge Connector",
        description: "GET /Occupancy/ChargeConnector/{ids} — EV charger availability",
        params: [
          { key: "ids", label: "Connector ID(s)", defaultValue: "ChargePointESB-UT08YZ-2" },
        ],
        buildPath: (v) => ({ path: `/Occupancy/ChargeConnector/${v.ids ?? ""}` }),
      },
    ],
  },
  {
    label: "Place",
    endpoints: [
      {
        id: "place-search",
        label: "Search",
        description: "GET /Place/Search — Search for places by name",
        params: [
          { key: "name", label: "Name", defaultValue: "Victoria" },
        ],
        buildPath: (v) => ({
          path: "/Place/Search",
          params: { name: v.name ?? "Victoria" },
        }),
      },
      {
        id: "place-by-type",
        label: "By Type",
        description: "GET /Place/Type/{types} — Places filtered by type",
        params: [
          { key: "types", label: "Place types", defaultValue: "NaptanMetroStation" },
        ],
        buildPath: (v) => ({ path: `/Place/Type/${encodeURIComponent(v.types ?? "NaptanMetroStation")}` }),
      },
      {
        id: "place-nearby",
        label: "Nearby",
        description: "GET /Place — Places within a radius of coordinates",
        params: [
          { key: "lat", label: "Latitude", defaultValue: "51.5045" },
          { key: "lon", label: "Longitude", defaultValue: "-0.0865" },
          { key: "radius", label: "Radius (m)", defaultValue: "200", type: "number" },
          { key: "type", label: "Type", placeholder: "NaptanMetroStation (optional)", defaultValue: "" },
        ],
        buildPath: (v) => ({
          path: "/Place",
          params: {
            lat: Number(v.lat),
            lon: Number(v.lon),
            radius: Number(v.radius ?? 200),
            type: v.type || undefined,
          },
        }),
      },
      {
        id: "place-by-id",
        label: "By ID",
        description: "GET /Place/{id} — Full details for a place",
        params: [
          { key: "id", label: "Place ID", defaultValue: "940GZZLUVIC" },
        ],
        buildPath: (v) => ({ path: `/Place/${encodeURIComponent(v.id ?? "940GZZLUVIC")}` }),
      },
      {
        id: "place-meta-types",
        label: "Meta / Place Types",
        description: "GET /Place/Meta/PlaceTypes — Valid place type identifiers",
        params: [],
        buildPath: () => ({ path: "/Place/Meta/PlaceTypes" }),
      },
    ],
  },
  {
    label: "Search",
    endpoints: [
      {
        id: "search",
        label: "Search",
        description: "GET /Search — Site-wide search across all TfL data",
        params: [
          { key: "query", label: "Query", defaultValue: "Victoria" },
        ],
        buildPath: (v) => ({
          path: "/Search",
          params: { query: v.query ?? "Victoria" },
        }),
      },
    ],
  },
  {
    label: "AirQuality",
    endpoints: [
      {
        id: "airquality",
        label: "Air Quality",
        description: "GET /AirQuality — Current and forecast London air quality index",
        params: [],
        buildPath: () => ({ path: "/AirQuality" }),
      },
    ],
  },
  {
    label: "AccidentStats",
    endpoints: [
      {
        id: "accidentstats",
        label: "Accident Stats",
        description: "GET /AccidentStats/{year} — Historic road accident statistics by year",
        params: [
          { key: "year", label: "Year", defaultValue: "2019", type: "number" },
        ],
        buildPath: (v) => ({ path: `/AccidentStats/${encodeURIComponent(v.year ?? "2019")}` }),
      },
    ],
  },
];

const EXPLORER_ENDPOINTS = EXPLORER_ENDPOINT_GROUPS.flatMap((g) => g.endpoints);

type DataEntityRow = { name: string; id: string };

type DataEntityDef = {
  id: string;
  label: string;
  description: string;
  rows?: DataEntityRow[];
  search?: (query: string) => Promise<DataEntityRow[]>;
};

const DATA_ENTITIES: DataEntityDef[] = [
  {
    id: "entity-tube-stations",
    label: "Tube Stations",
    description: "NaptanIDs for London Underground stations — use with StopPoint Arrivals and StopPoint Details",
    rows: [
      { name: "Aldgate", id: "940GZZLUALD" },
      { name: "Angel", id: "940GZZLUAGL" },
      { name: "Baker Street", id: "940GZZLUBKR" },
      { name: "Bank / Monument", id: "940GZZLUBNK" },
      { name: "Barbican", id: "940GZZLUBBN" },
      { name: "Bermondsey", id: "940GZZLUBMY" },
      { name: "Borough", id: "940GZZLUBRO" },
      { name: "Brixton", id: "940GZZLUBXN" },
      { name: "Canary Wharf", id: "940GZZLUCWR" },
      { name: "Cannon Street", id: "940GZZLUCST" },
      { name: "Clapham Common", id: "940GZZLUCPC" },
      { name: "Clapham North", id: "940GZZLUCPN" },
      { name: "Clapham South", id: "940GZZLUCPS" },
      { name: "Elephant & Castle", id: "940GZZLUEAC" },
      { name: "Euston", id: "940GZZLUEUS" },
      { name: "Farringdon", id: "940GZZLUFCN" },
      { name: "Finsbury Park", id: "940GZZLUFPK" },
      { name: "Green Park", id: "940GZZLUGPK" },
      { name: "Holborn", id: "940GZZLUHBN" },
      { name: "King's Cross St. Pancras", id: "940GZZLUKSX" },
      { name: "Knightsbridge", id: "940GZZLUKNB" },
      { name: "Liverpool Street", id: "940GZZLULVS" },
      { name: "London Bridge", id: "940GZZLULNB" },
      { name: "Moorgate", id: "940GZZLUMGT" },
      { name: "Old Street", id: "940GZZLUOLD" },
      { name: "Oxford Circus", id: "940GZZLUOXC" },
      { name: "Paddington", id: "940GZZLUPAC" },
      { name: "Pimlico", id: "940GZZLUPCO" },
      { name: "Sloane Square", id: "940GZZLUSQS" },
      { name: "Southwark", id: "940GZZLUSWK" },
      { name: "St. James's Park", id: "940GZZLUSJP" },
      { name: "St. Paul's", id: "940GZZLUSPU" },
      { name: "Stockwell", id: "940GZZLUSKW" },
      { name: "Stratford", id: "940GZZLUSTA" },
      { name: "Tower Hill", id: "940GZZLUTOH" },
      { name: "Vauxhall", id: "940GZZLUVXH" },
      { name: "Victoria", id: "940GZZLUVIC" },
      { name: "Waterloo", id: "940GZZLUWLO" },
      { name: "Westminster", id: "940GZZLUWSM" },
    ],
  },
  {
    id: "entity-tube-lines",
    label: "Tube Lines",
    description: "TfL line IDs for use in Line endpoints, status queries, and route filters",
    rows: [
      { name: "Bakerloo", id: "bakerloo" },
      { name: "Central", id: "central" },
      { name: "Circle", id: "circle" },
      { name: "District", id: "district" },
      { name: "DLR", id: "dlr" },
      { name: "Elizabeth line", id: "elizabeth" },
      { name: "Hammersmith & City", id: "hammersmith-city" },
      { name: "Jubilee", id: "jubilee" },
      { name: "London Overground", id: "london-overground" },
      { name: "Metropolitan", id: "metropolitan" },
      { name: "Northern", id: "northern" },
      { name: "Piccadilly", id: "piccadilly" },
      { name: "Tram", id: "tram" },
      { name: "Victoria", id: "victoria" },
      { name: "Waterloo & City", id: "waterloo-city" },
    ],
  },
  {
    id: "entity-bus-stops",
    label: "Bus Stops",
    description: "Search for London bus stops by name or area — results show NaptanIDs for use in StopPoint endpoints",
    search: async (query: string) => {
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
    },
  },
  {
    id: "entity-modes",
    label: "Transport Modes",
    description: "Mode identifiers accepted by StopPoint and Line endpoints",
    rows: [
      { name: "Bus", id: "bus" },
      { name: "Cable Car", id: "cable-car" },
      { name: "Coach", id: "coach" },
      { name: "DLR", id: "dlr" },
      { name: "Elizabeth line", id: "elizabeth-line" },
      { name: "National Rail", id: "national-rail" },
      { name: "Overground", id: "overground" },
      { name: "River Bus", id: "river-bus" },
      { name: "Tram", id: "tram" },
      { name: "Tube", id: "tube" },
      { name: "Walking", id: "walking" },
    ],
  },
];

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

function explorerResultSummary(data: unknown): string {
  if (Array.isArray(data)) return `Array — ${data.length} item${data.length === 1 ? "" : "s"}`;
  if (data !== null && typeof data === "object") {
    const keys = Object.keys(data as object).length;
    return `Object — ${keys} key${keys === 1 ? "" : "s"}`;
  }
  return typeof data;
}

function buildPreviewUrl(endpoint: ExplorerEndpointDef, values: Record<string, string>): string {
  try {
    const { path, params } = endpoint.buildPath(values);
    const url = new URL(path.replace(/^\//, ""), "https://api.tfl.gov.uk/");
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v === undefined) continue;
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, String(item));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  } catch {
    return "";
  }
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

type ExplorerCellState = {
  paramValues: Record<string, string>;
  loading: boolean;
  result: unknown;
  error: string | null;
  meta: { ms: number; summary: string; bytes: number } | null;
};

type ExplorerNotebookSection = {
  id: string;
  label: string;
  description: string;
  endpointIds: string[];
};

const EXPLORER_ENDPOINT_BY_ID = Object.fromEntries(
  EXPLORER_ENDPOINTS.map((endpoint) => [endpoint.id, endpoint]),
) as Record<string, ExplorerEndpointDef>;

const EXPLORER_NOTEBOOK_SECTIONS: ExplorerNotebookSection[] = [
  {
    id: "stop-workbench",
    label: "Stop Workbench",
    description: "Search stops, then inspect details, nearby points, routes, and arrivals.",
    endpointIds: [
      "stoppoint-search",
      "stoppoint-details",
      "stoppoint-arrivals",
      "stoppoint-nearby",
      "stoppoint-route",
      "stoppoint-disruption",
    ],
  },
  {
    id: "line-workbench",
    label: "Line Workbench",
    description: "Search lines, then inspect status, routes, stops, and disruptions.",
    endpointIds: [
      "line-search",
      "line-by-id",
      "line-status",
      "line-route-sequence",
      "line-stop-points",
      "line-arrivals-at-stop",
      "line-disruption",
    ],
  },
  {
    id: "journey-and-places",
    label: "Journey And Places",
    description: "Plan journeys and look up related places in one flow.",
    endpointIds: [
      "journey-results",
      "place-search",
      "place-nearby",
      "place-by-id",
      "search",
    ],
  },
  {
    id: "city-systems",
    label: "City Systems",
    description: "Explore bikes, roads, vehicles, occupancy, and city datasets.",
    endpointIds: [
      "bikepoint-search",
      "bikepoint-by-id",
      "bikepoint-all",
      "vehicle-arrivals",
      "road-status",
      "road-disruption",
      "occupancy-bike-points",
      "airquality",
      "accidentstats",
    ],
  },
  {
    id: "metadata",
    label: "Metadata Shelf",
    description: "Reference modes, severities, categories, and other metadata.",
    endpointIds: [
      "stoppoint-meta-modes",
      "stoppoint-meta-stoptypes",
      "line-meta-modes",
      "line-meta-severity",
      "line-meta-disruption-categories",
      "journey-meta-modes",
      "mode-active-service-types",
      "road-meta-severities",
      "road-meta-categories",
      "place-meta-types",
    ],
  },
];

function explorerInputValues(
  endpoint: ExplorerEndpointDef,
  paramValues: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    endpoint.params.map((param) => [param.key, paramValues[param.key] ?? param.defaultValue]),
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
      setSearchResults(await entity.search(searchQuery.trim()));
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
            placeholder="Search stops…"
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
            {searching ? "Searching…" : "Search"}
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
    () => buildPreviewUrl(endpoint, currentValues),
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
              // Safe: value is JSON.stringify output, HTML-escaped before regex replacement
              dangerouslySetInnerHTML={{ __html: highlightJson(cellState.result) }}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SettingsWorkbench() {
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
        <h2>API Settings</h2>
        <p>Store a TfL API key in this browser to use it for explorer requests.</p>
      </div>

      <div className="settings-panel">
        <label className="settings-field">
          <span>TfL API key</span>
          <input
            type="password"
            placeholder="Paste TfL app_key"
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

function ExplorerPage() {
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    EXPLORER_NOTEBOOK_SECTIONS[0].id,
  );
  const [cellStates, setCellStates] = useState<Record<string, ExplorerCellState>>(() =>
    Object.fromEntries(
      EXPLORER_ENDPOINTS.map((endpoint) => [endpoint.id, initialExplorerCellState()]),
    ) as Record<string, ExplorerCellState>,
  );
  const selectedSection =
    EXPLORER_NOTEBOOK_SECTIONS.find((section) => section.id === selectedSectionId) ??
    EXPLORER_NOTEBOOK_SECTIONS[0];

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
      <HeaderBar currentPage="explorer" />
      <main className="explorer-notebook-page">
        <div className="explorer-workbench-layout">
          <aside className="explorer-workbench-sidebar" aria-label="Workbench sections">
            <p className="explorer-sidebar-title">Workbenches</p>
            <div className="explorer-sidebar-group">
              <p className="explorer-sidebar-group-label">TfL</p>
              <div className="explorer-sidebar-list">
                {EXPLORER_NOTEBOOK_SECTIONS.map((section) => (
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
                  <strong>Reference IDs</strong>
                  <span>Common TfL station, line, mode, and bus stop IDs.</span>
                </button>
                <button
                  type="button"
                  className={`explorer-sidebar-item${
                    selectedSectionId === "settings" ? " explorer-sidebar-item--active" : ""
                  }`}
                  onClick={() => setSelectedSectionId("settings")}
                >
                  <strong>Settings</strong>
                  <span>Set the browser API key used for TfL requests.</span>
                </button>
              </div>
            </div>
          </aside>

          <div className="explorer-notebook">
            {selectedSectionId === "settings" ? (
              <SettingsWorkbench />
            ) : selectedSectionId === "reference-ids" ? (
              <section id="reference-ids" className="notebook-section">
                <div className="notebook-section-header">
                  <p className="explorer-kicker">TfL Reference</p>
                  <h2>TfL reference IDs</h2>
                  <p>
                    Static and searchable ID lists for common TfL stop, line, and mode values.
                  </p>
                </div>
                <div className="reference-grid">
                  {DATA_ENTITIES.map((entity) => (
                    <ReferenceCard key={entity.id} entity={entity} />
                  ))}
                </div>
              </section>
            ) : (
              <section key={selectedSection.id} id={selectedSection.id} className="notebook-section">
                <div className="notebook-section-header">
                  <p className="explorer-kicker">TfL Workbench</p>
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

export default function App() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const handler = () => setHash(window.location.hash);
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  if (hash === "#search") return <SearchPage />;
  if (hash === "#explorer") return <ExplorerPage />;
  return <IndexPage />;
}
