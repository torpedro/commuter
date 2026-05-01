export const TFL_API_BASE = "https://api.tfl.gov.uk";
const stopPointEndpoints = [
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
                modes: (v.modes ?? "bus")
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
        params: [{ key: "stopPointId", label: "Stop ID", defaultValue: "490000139R" }],
        buildPath: (v) => ({
            path: `/StopPoint/${encodeURIComponent(v.stopPointId ?? "")}/Arrivals`,
        }),
    },
    {
        id: "stoppoint-details",
        label: "Details",
        description: "GET /StopPoint/{ids} — Full stop metadata including child stops",
        params: [{ key: "ids", label: "Stop ID(s)", defaultValue: "940GZZLULNB" }],
        buildPath: (v) => ({ path: `/StopPoint/${v.ids ?? "940GZZLULNB"}` }),
    },
    {
        id: "stoppoint-disruption",
        label: "Disruption",
        description: "GET /StopPoint/{ids}/Disruption — Disruptions affecting a stop",
        params: [{ key: "ids", label: "Stop ID(s)", defaultValue: "940GZZLULNB" }],
        buildPath: (v) => ({ path: `/StopPoint/${v.ids ?? "940GZZLULNB"}/Disruption` }),
    },
    {
        id: "stoppoint-disruption-by-mode",
        label: "Disruption by Mode",
        description: "GET /StopPoint/Mode/{modes}/Disruption — Disrupted stops for a transport mode",
        params: [{ key: "modes", label: "Modes", defaultValue: "tube" }],
        buildPath: (v) => ({
            path: `/StopPoint/Mode/${encodeURIComponent(v.modes ?? "tube")}/Disruption`,
        }),
    },
    {
        id: "stoppoint-route",
        label: "Route",
        description: "GET /StopPoint/{id}/Route — Route sections through a stop",
        params: [{ key: "id", label: "Stop ID", defaultValue: "940GZZLULNB" }],
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
        params: [{ key: "types", label: "Stop types", defaultValue: "NaptanMetroStation" }],
        buildPath: (v) => ({
            path: `/StopPoint/Type/${encodeURIComponent(v.types ?? "NaptanMetroStation")}`,
        }),
    },
    {
        id: "stoppoint-car-parks",
        label: "Car Parks",
        description: "GET /StopPoint/{stopPointId}/CarParks — Car parks near a stop",
        params: [{ key: "stopPointId", label: "Stop ID", defaultValue: "940GZZLULNB" }],
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
];
const lineEndpoints = [
    {
        id: "line-by-id",
        label: "By ID",
        description: "GET /Line/{ids} — Line metadata for one or more lines",
        params: [{ key: "ids", label: "Line ID(s)", placeholder: "jubilee,northern", defaultValue: "jubilee" }],
        buildPath: (v) => ({ path: `/Line/${v.ids ?? "jubilee"}` }),
    },
    {
        id: "line-by-mode",
        label: "By Mode",
        description: "GET /Line/Mode/{modes} — All lines for a transport mode",
        params: [{ key: "modes", label: "Modes", defaultValue: "tube" }],
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
        params: [{ key: "ids", label: "Line ID(s)", defaultValue: "149" }],
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
        params: [{ key: "ids", label: "Line ID(s)", defaultValue: "jubilee" }],
        buildPath: (v) => ({ path: `/Line/${v.ids ?? "jubilee"}/Disruption` }),
    },
    {
        id: "line-disruption-by-mode",
        label: "Disruption by Mode",
        description: "GET /Line/Mode/{modes}/Disruption — Disruptions for all lines of a mode",
        params: [{ key: "modes", label: "Modes", defaultValue: "tube" }],
        buildPath: (v) => ({ path: `/Line/Mode/${encodeURIComponent(v.modes ?? "tube")}/Disruption` }),
    },
    {
        id: "line-stop-points",
        label: "Stop Points",
        description: "GET /Line/{id}/StopPoints — All stops served by a line",
        params: [{ key: "id", label: "Line ID", defaultValue: "jubilee" }],
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
];
const otherEndpoints = [
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
                params: [{ key: "ids", label: "Vehicle ID(s)", placeholder: "LTZ1001", defaultValue: "LTZ1001" }],
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
                params: [{ key: "id", label: "BikePoint ID", defaultValue: "BikePoints_1" }],
                buildPath: (v) => ({ path: `/BikePoint/${encodeURIComponent(v.id ?? "BikePoints_1")}` }),
            },
            {
                id: "bikepoint-search",
                label: "Search",
                description: "GET /BikePoint/Search — Search for docking stations by name",
                params: [{ key: "query", label: "Query", defaultValue: "London Bridge" }],
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
                params: [{ key: "ids", label: "Road ID(s)", placeholder: "A2,A3", defaultValue: "A2" }],
                buildPath: (v) => ({ path: `/Road/${v.ids ?? "A2"}` }),
            },
            {
                id: "road-status",
                label: "Status",
                description: "GET /Road/{ids}/Status — Current traffic status for road corridors",
                params: [{ key: "ids", label: "Road ID(s)", defaultValue: "A2" }],
                buildPath: (v) => ({ path: `/Road/${v.ids ?? "A2"}/Status` }),
            },
            {
                id: "road-disruption",
                label: "Disruption",
                description: "GET /Road/{ids}/Disruption — Active disruptions on road corridors",
                params: [{ key: "ids", label: "Road ID(s)", defaultValue: "A2" }],
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
                params: [{ key: "ids", label: "BikePoint ID(s)", defaultValue: "BikePoints_1" }],
                buildPath: (v) => ({ path: `/Occupancy/BikePoints/${v.ids ?? "BikePoints_1"}` }),
            },
            {
                id: "occupancy-charge-connector",
                label: "EV Charge Connector",
                description: "GET /Occupancy/ChargeConnector/{ids} — EV charger availability",
                params: [{ key: "ids", label: "Connector ID(s)", defaultValue: "ChargePointESB-UT08YZ-2" }],
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
                params: [{ key: "name", label: "Name", defaultValue: "Victoria" }],
                buildPath: (v) => ({
                    path: "/Place/Search",
                    params: { name: v.name ?? "Victoria" },
                }),
            },
            {
                id: "place-by-type",
                label: "By Type",
                description: "GET /Place/Type/{types} — Places filtered by type",
                params: [{ key: "types", label: "Place types", defaultValue: "NaptanMetroStation" }],
                buildPath: (v) => ({
                    path: `/Place/Type/${encodeURIComponent(v.types ?? "NaptanMetroStation")}`,
                }),
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
                params: [{ key: "id", label: "Place ID", defaultValue: "940GZZLUVIC" }],
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
                params: [{ key: "query", label: "Query", defaultValue: "Victoria" }],
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
                params: [{ key: "year", label: "Year", defaultValue: "2019", type: "number" }],
                buildPath: (v) => ({ path: `/AccidentStats/${encodeURIComponent(v.year ?? "2019")}` }),
            },
        ],
    },
];
export const EXPLORER_ENDPOINT_GROUPS = [
    { label: "StopPoint", endpoints: stopPointEndpoints },
    { label: "Line", endpoints: lineEndpoints },
    ...otherEndpoints,
];
export const EXPLORER_ENDPOINTS = EXPLORER_ENDPOINT_GROUPS.flatMap((group) => group.endpoints);
