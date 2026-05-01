import type { ExplorerParamDef } from "../explorer/types.js";
import {
  NATIONAL_RAIL_LDB_NAMESPACE,
  type NationalRailSoapRequest,
} from "./client.js";

export type NationalRailRpcDef = {
  id: string;
  label: string;
  description: string;
  params: ExplorerParamDef[];
  request: (values: Record<string, string>) => NationalRailSoapRequest;
  normalize: (result: unknown) => unknown;
};

export type NationalRailRpcGroup = {
  label: string;
  rpcIds: string[];
};

type BoardOperation =
  | "GetDepartureBoard"
  | "GetArrivalBoard"
  | "GetArrivalDepartureBoard"
  | "GetDepBoardWithDetails"
  | "GetArrBoardWithDetails"
  | "GetArrDepBoardWithDetails";

type RouteOperation =
  | "GetNextDepartures"
  | "GetNextDeparturesWithDetails"
  | "GetFastestDepartures"
  | "GetFastestDeparturesWithDetails";

const BOARD_RPCS: NationalRailRpcDef[] = [
  makeBoardRpc("departure-board", "Departure Board", "GetDepartureBoard"),
  makeBoardRpc("arrival-board", "Arrival Board", "GetArrivalBoard"),
  makeBoardRpc("arrival-departure-board", "Arrival And Departure Board", "GetArrivalDepartureBoard"),
  makeBoardRpc("departure-board-details", "Departure Board With Details", "GetDepBoardWithDetails"),
  makeBoardRpc("arrival-board-details", "Arrival Board With Details", "GetArrBoardWithDetails"),
  makeBoardRpc(
    "arrival-departure-board-details",
    "Arrival And Departure Board With Details",
    "GetArrDepBoardWithDetails",
  ),
];

const ROUTE_RPCS: NationalRailRpcDef[] = [
  makeRouteRpc("next-departures", "Next Departures", "GetNextDepartures"),
  makeRouteRpc(
    "next-departures-details",
    "Next Departures With Details",
    "GetNextDeparturesWithDetails",
  ),
  makeRouteRpc("fastest-departures", "Fastest Departures", "GetFastestDepartures"),
  makeRouteRpc(
    "fastest-departures-details",
    "Fastest Departures With Details",
    "GetFastestDeparturesWithDetails",
  ),
];

export const NATIONAL_RAIL_RPCS: NationalRailRpcDef[] = [
  ...BOARD_RPCS,
  ...ROUTE_RPCS,
  {
    id: "service-details",
    label: "Service Details",
    description: "SOAP GetServiceDetails — Full details for a service ID from a live board",
    params: [{ key: "serviceID", label: "Service ID", defaultValue: "" }],
    request: (values) => ({
      operation: "GetServiceDetails",
      soapAction: "http://thalesgroup.com/RTTI/2012-01-13/ldb/GetServiceDetails",
      responseElement: "GetServiceDetailsResponse",
      resultElement: "GetServiceDetailsResult",
      bodyXml: wrapRequest(
        "GetServiceDetailsRequest",
        xmlElement("ldb:serviceID", required(values.serviceID, "serviceID")),
      ),
    }),
    normalize: normalizeServiceDetails,
  },
];

export const NATIONAL_RAIL_RPC_GROUPS: NationalRailRpcGroup[] = [
  {
    label: "Live Boards",
    rpcIds: [
      "departure-board",
      "arrival-board",
      "arrival-departure-board",
      "departure-board-details",
      "arrival-board-details",
      "arrival-departure-board-details",
      "service-details",
    ],
  },
  {
    label: "Route Filters",
    rpcIds: [
      "next-departures",
      "next-departures-details",
      "fastest-departures",
      "fastest-departures-details",
    ],
  },
];

export function nationalRailInputValues(
  rpc: NationalRailRpcDef,
  paramValues: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    rpc.params.map((param) => [param.key, paramValues[param.key] ?? param.defaultValue]),
  );
}

export function buildNationalRailPreview(rpc: NationalRailRpcDef, values: Record<string, string>): string {
  return `${rpc.request(values).operation} ${JSON.stringify(values)}`;
}

function makeBoardRpc(id: string, label: string, operation: BoardOperation): NationalRailRpcDef {
  return {
    id,
    label,
    description: `SOAP ${operation} — Live station board for a CRS code`,
    params: [
      { key: "crs", label: "CRS", defaultValue: "KGX" },
      { key: "numRows", label: "Rows", defaultValue: "10", type: "number" },
      { key: "filterCrs", label: "Filter CRS", defaultValue: "" },
      { key: "filterType", label: "Filter type", defaultValue: "to" },
      { key: "timeOffset", label: "Time offset", defaultValue: "0", type: "number" },
      { key: "timeWindow", label: "Time window", defaultValue: "120", type: "number" },
    ],
    request: (values) => ({
      operation,
      soapAction: soapAction(operation),
      responseElement: `${operation}Response`,
      resultElement: "GetStationBoardResult",
      bodyXml: wrapRequest(
        `${operation}Request`,
        [
          xmlElement("ldb:numRows", clampUnsignedShort(values.numRows, 10)),
          xmlElement("ldb:crs", required(values.crs, "crs").toUpperCase()),
          optionalElement("ldb:filterCrs", optionalCrs(values.filterCrs)),
          optionalElement("ldb:filterType", optionalFilterType(values.filterType)),
          optionalElement("ldb:timeOffset", optionalInteger(values.timeOffset)),
          optionalElement("ldb:timeWindow", optionalInteger(values.timeWindow)),
        ].join(""),
      ),
    }),
    normalize: normalizeStationBoard,
  };
}

function makeRouteRpc(id: string, label: string, operation: RouteOperation): NationalRailRpcDef {
  return {
    id,
    label,
    description: `SOAP ${operation} — Next or fastest departures from one CRS to a filter list`,
    params: [
      { key: "crs", label: "CRS", defaultValue: "KGX" },
      { key: "filterList", label: "Filter list", defaultValue: "CBG,EDB" },
      { key: "timeOffset", label: "Time offset", defaultValue: "0", type: "number" },
      { key: "timeWindow", label: "Time window", defaultValue: "120", type: "number" },
    ],
    request: (values) => ({
      operation,
      soapAction: soapAction(operation),
      responseElement: `${operation}Response`,
      resultElement: "DeparturesBoard",
      bodyXml: wrapRequest(
        `${operation}Request`,
        [
          xmlElement("ldb:crs", required(values.crs, "crs").toUpperCase()),
          xmlElement(
            "ldb:filterList",
            parseCrsList(values.filterList)
              .map((crs) => xmlElement("ldb:crs", crs))
              .join(""),
          ),
          optionalElement("ldb:timeOffset", optionalInteger(values.timeOffset)),
          optionalElement("ldb:timeWindow", optionalInteger(values.timeWindow)),
        ].join(""),
      ),
    }),
    normalize: normalizeDeparturesBoard,
  };
}

function soapAction(operation: BoardOperation | RouteOperation | "GetServiceDetails"): string {
  const newer = new Set([
    "GetDepBoardWithDetails",
    "GetArrBoardWithDetails",
    "GetArrDepBoardWithDetails",
    "GetNextDepartures",
    "GetNextDeparturesWithDetails",
    "GetFastestDepartures",
    "GetFastestDeparturesWithDetails",
  ]);
  const version = newer.has(operation) ? "2015-05-14" : "2012-01-13";
  return `http://thalesgroup.com/RTTI/${version}/ldb/${operation}`;
}

function wrapRequest(requestElement: string, innerXml: string): string {
  return `<ldb:${requestElement} xmlns:ldb="${NATIONAL_RAIL_LDB_NAMESPACE}">${innerXml}</ldb:${requestElement}>`;
}

function xmlElement(tag: string, value: string): string {
  return `<${tag}>${xmlEscape(value)}</${tag}>`;
}

function optionalElement(tag: string, value: string | undefined): string {
  return value ? xmlElement(tag, value) : "";
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function required(value: string | undefined, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing required parameter: ${label}`);
  }
  return trimmed;
}

function clampUnsignedShort(value: string | undefined, fallback: number): string {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return String(fallback);
  }
  return String(Math.min(parsed, 65535));
}

function optionalInteger(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer value: ${value}`);
  }
  return String(parsed);
}

function optionalCrs(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : undefined;
}

function optionalFilterType(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed !== "to" && trimmed !== "from") {
    throw new Error(`Invalid filterType: ${value}`);
  }
  return trimmed;
}

function parseCrsList(value: string | undefined): string[] {
  const items = (value ?? "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  if (!items.length) {
    throw new Error("filterList must include at least one CRS code");
  }
  return items;
}

function normalizeStationBoard(result: unknown): unknown {
  const board = asRecord(result);
  if (!board) {
    return result;
  }
  return {
    generatedAt: stringValue(board.generatedAt),
    locationName: stringValue(board.locationName),
    crs: stringValue(board.crs),
    platformAvailable: booleanValue(board.platformAvailable),
    areServicesAvailable: extractBoardServices(board).length > 0,
    nrccMessages: extractMessages(board.nrccMessages),
    services: extractBoardServices(board),
  };
}

function normalizeDeparturesBoard(result: unknown): unknown {
  const board = asRecord(result);
  if (!board) {
    return result;
  }
  return {
    generatedAt: stringValue(board.generatedAt),
    locationName: stringValue(board.locationName),
    crs: stringValue(board.crs),
    nrccMessages: extractMessages(board.nrccMessages),
    destinations: asArray(asRecord(board.departures)?.destination).map((destination) => {
      const item = asRecord(destination);
      return {
        destination: {
          locationName: stringValue(item?.locationName),
          crs: stringValue(item?.crs),
        },
        service: normalizeBoardService(asRecord(item?.service)),
      };
    }),
  };
}

function normalizeServiceDetails(result: unknown): unknown {
  const service = asRecord(result);
  if (!service) {
    return result;
  }
  return {
    generatedAt: stringValue(service.generatedAt),
    serviceType: stringValue(service.serviceType),
    locationName: stringValue(service.locationName),
    crs: stringValue(service.crs),
    operator: stringValue(service.operator),
    operatorCode: stringValue(service.operatorCode),
    rsid: stringValue(service.rsid),
    serviceID: stringValue(service.serviceID),
    platform: stringValue(service.platform),
    trainLength: stringValue(service.length),
    scheduled: {
      arrival: stringValue(service.sta),
      departure: stringValue(service.std),
    },
    expected: {
      arrival: stringValue(service.eta),
      departure: stringValue(service.etd),
    },
    actual: {
      arrival: stringValue(service.ata),
      departure: stringValue(service.atd),
    },
    origin: normalizeLocations(service.origin),
    destination: normalizeLocations(service.destination),
    cancelled: booleanValue(service.isCancelled),
    cancelReason: stringValue(service.cancelReason),
    delayReason: stringValue(service.delayReason),
    adhocAlerts: extractMessages(service.adhocAlerts),
    previousCallingPoints: normalizeCallingPointLists(service.previousCallingPoints),
    subsequentCallingPoints: normalizeCallingPointLists(service.subsequentCallingPoints),
  };
}

function extractBoardServices(board: Record<string, unknown>): unknown[] {
  const groups = ["trainServices", "busServices", "ferryServices"];
  return groups.flatMap((key) => {
    const container = asRecord(board[key]);
    return asArray(container?.service).map((service) => normalizeBoardService(asRecord(service)));
  });
}

function normalizeBoardService(service: Record<string, unknown> | null): unknown {
  if (!service) {
    return null;
  }
  return {
    serviceType: stringValue(service.serviceType),
    serviceID: stringValue(service.serviceID),
    rsid: stringValue(service.rsid),
    operator: stringValue(service.operator),
    operatorCode: stringValue(service.operatorCode),
    platform: stringValue(service.platform),
    trainLength: stringValue(service.length),
    origin: normalizeLocations(service.origin),
    destination: normalizeLocations(service.destination),
    scheduled: {
      arrival: stringValue(service.sta),
      departure: stringValue(service.std),
    },
    expected: {
      arrival: stringValue(service.eta),
      departure: stringValue(service.etd),
    },
    actual: {
      arrival: stringValue(service.ata),
      departure: stringValue(service.atd),
    },
    cancelled: booleanValue(service.isCancelled),
    delayed: booleanValue(service.isDelayed),
    cancelReason: stringValue(service.cancelReason),
    delayReason: stringValue(service.delayReason),
    adhocAlerts: extractMessages(service.adhocAlerts),
    previousCallingPoints: normalizeCallingPointLists(service.previousCallingPoints),
    subsequentCallingPoints: normalizeCallingPointLists(service.subsequentCallingPoints),
  };
}

function normalizeLocations(value: unknown): unknown[] {
  return asArray(asRecord(value)?.location).map((location) => {
    const item = asRecord(location);
    return item
      ? {
          locationName: stringValue(item.locationName),
          crs: stringValue(item.crs),
          via: stringValue(item.via),
          futureChangeTo: stringValue(item.futureChangeTo),
        }
      : location;
  });
}

function normalizeCallingPointLists(value: unknown): unknown[] {
  return asArray(asRecord(value)?.callingPointList).map((list) => {
    const record = asRecord(list);
    return {
      serviceType: stringValue(record?.["@serviceType"]) ?? stringValue(record?.serviceType),
      serviceChangeRequired: booleanValue(record?.["@serviceChangeRequired"] ?? record?.serviceChangeRequired),
      associationsCancelled: booleanValue(record?.["@associationsCancelled"] ?? record?.associationsCancelled),
      callingPoints: asArray(record?.callingPoint).map((callingPoint) => {
        const item = asRecord(callingPoint);
        return {
          locationName: stringValue(item?.locationName),
          crs: stringValue(item?.crs),
          scheduledTime: stringValue(item?.st),
          expectedTime: stringValue(item?.et),
          actualTime: stringValue(item?.at),
          cancelled: booleanValue(item?.isCancelled),
          length: stringValue(item?.length),
          detachFront: booleanValue(item?.detachFront),
          adhocAlerts: extractMessages(item?.adhocAlerts),
        };
      }),
    };
  });
}

function extractMessages(value: unknown): string[] {
  const record = asRecord(value);
  if (!record) {
    return [];
  }
  return asArray(record.adhocAlert ?? record.message)
    .map((item) => stringValue(item))
    .filter((item): item is string => Boolean(item));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "true") {
      return true;
    }
    if (trimmed === "false") {
      return false;
    }
  }
  return undefined;
}
