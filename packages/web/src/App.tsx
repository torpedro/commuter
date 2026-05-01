import { useCallback, useEffect, useMemo, useState } from "react";
import ExplorerPage from "./explorer/ExplorerPage";
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

export default function App() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const handler = () => setHash(window.location.hash);
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  if (hash === "#search") return <SearchPage />;
  if (hash === "#explorer") return <ExplorerPage HeaderBar={HeaderBar} />;
  return <IndexPage />;
}
