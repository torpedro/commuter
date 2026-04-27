# TfL Unified API

Base URL:

```text
https://api.tfl.gov.uk
```

Authentication is passed as query parameters. This app uses `app_key`.

## API Areas

The official TfL Unified API exposes these main resource areas:

- `StopPoint`: stops, stations, nearby lookup, stop details, arrivals.
- `Line`: route metadata, line status, disruptions, route sequences, arrivals.
- `Journey`: journey planning between two places.
- `Mode`: mode metadata and status, such as bus, tube, rail.
- `Vehicle`: lookup predictions for a specific vehicle.
- `BikePoint`: Santander Cycles locations and availability.
- `Road`: road status, corridors, and disruptions.
- `Occupancy`: occupancy/crowding data where available.
- `Place`: geographic places and points of interest.
- `Search`: general search across TfL data.
- `AirQuality`: air quality feed.
- `AccidentStats`: historic accident statistics.

## Endpoints Used By This App

### Search for a stop or station

```text
GET /StopPoint/Search/{query}
```

Used to infer a station/stop location from a text query such as
`London Bridge Station`.

Useful parameters:

- `modes`: for example `bus` or `tube`.
- `includeHubs`: include hub/interchange results.
- `maxResults`: limit result count.

### Get stop/station details

```text
GET /StopPoint/{id}
```

Used as a fallback to get coordinates and child stop points from a search result.

Useful fields:

- `id`
- `naptanId`
- `commonName`
- `stopLetter`
- `stopType`
- `modes`
- `children`
- `lat`
- `lon`
- `additionalProperties`

### Find nearby stop points

```text
GET /StopPoint
```

Used after inferring coordinates from a search result.

Useful parameters:

- `lat`
- `lon`
- `radius`
- `modes`
- `stopTypes`

Examples used by the app:

```text
modes=bus&stopTypes=NaptanPublicBusCoachTram
modes=tube&stopTypes=NaptanMetroStation
```

### Get live arrivals

```text
GET /StopPoint/{id}/Arrivals
```

Used for bus stops and Tube stations. Returns prediction objects.

Useful fields:

- `lineName`
- `destinationName`
- `stationName`
- `timeToStation`
- `platformName`
- `towards`
- `currentLocation`
- `expectedArrival`

## Useful Future Additions

### Line status

```text
GET /Line/{ids}/Status
GET /Line/Mode/{modes}/Status
```

Could show disruptions or service quality for saved bus/Tube lines.

### Route sequence

```text
GET /Line/{id}/Route/Sequence/{direction}
```

Could help with direction-aware filtering and stop ordering.

### Disruptions

```text
GET /Line/{ids}/Disruption
GET /StopPoint/{ids}/Disruption
```

Could show disruption warnings near saved searches.

### Journey planning

```text
GET /Journey/JourneyResults/{from}/to/{to}
```

Could turn saved searches into commute plans.

### Cycle hire

```text
GET /BikePoint
GET /BikePoint/Search
```

Could show Santander Cycles availability near the inferred location.

### Direction Filtering

For buses, the simplest useful direction filter is usually based on
`destinationName`. For richer direction handling, inspect stop metadata such as:

- `additionalProperties` with keys like `Towards`
- `CompassPoint`
- `stopLetter`
- route sequence direction data from `Line`

