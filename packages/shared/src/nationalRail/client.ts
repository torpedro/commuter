import { XMLParser } from "fast-xml-parser";

export type NationalRailFetchLikeResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  headers: {
    get(name: string): string | null;
  };
};

export type NationalRailFetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<NationalRailFetchLikeResponse>;

export type NationalRailClientConfig = {
  endpoint?: string | (() => string);
  accessToken?: string | (() => string);
  fetchFn: NationalRailFetchLike;
};

export type NationalRailSoapRequest = {
  operation: string;
  soapAction: string;
  bodyXml: string;
  responseElement: string;
  resultElement: string;
};

export const NATIONAL_RAIL_ENDPOINT = "https://lite.realtime.nationalrail.co.uk/OpenLDBWS/ldb12.asmx";
export const NATIONAL_RAIL_LDB_NAMESPACE = "http://thalesgroup.com/RTTI/2021-11-01/ldb/";
export const NATIONAL_RAIL_TOKEN_NAMESPACE = "http://thalesgroup.com/RTTI/2013-11-28/Token/types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

export class NationalRailApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NationalRailApiError";
  }
}

export function createNationalRailClient(config: NationalRailClientConfig) {
  return {
    async call<T>(request: NationalRailSoapRequest): Promise<T> {
      const endpoint = resolveValue(config.endpoint) || NATIONAL_RAIL_ENDPOINT;
      const token = resolveValue(config.accessToken);
      if (!token) {
        throw new NationalRailApiError(
          "No National Rail access token configured. Set NATIONAL_RAIL_TOKEN or create apikeys/nre.",
        );
      }

      const envelope = buildSoapEnvelope(token, request.bodyXml);

      let response: NationalRailFetchLikeResponse;
      try {
        response = await config.fetchFn(endpoint, {
          method: "POST",
          headers: {
            Accept: "text/xml, application/soap+xml, */*",
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: request.soapAction,
          },
          body: envelope,
        });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        throw new NationalRailApiError(
          `Could not request National Rail operation ${request.operation}: ${message}`,
        );
      }

      const body = await response.text();
      const contentType = response.headers.get("content-type") ?? "unknown content type";

      if (!response.ok) {
        throw new NationalRailApiError(
          `National Rail operation ${request.operation} returned ${response.status}. Response: ${responsePreview(body)}`,
        );
      }

      let parsed: unknown;
      try {
        parsed = parser.parse(body);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        throw new NationalRailApiError(
          `National Rail operation ${request.operation} returned invalid XML. Content-Type: ${contentType}. Parse error: ${message}. Response: ${responsePreview(body)}`,
        );
      }

      const soapBody = asRecord(asRecord(parsed)?.Envelope)?.Body;
      const fault = asRecord(asRecord(soapBody)?.Fault);
      if (fault) {
        const code = stringValue(fault.faultcode) ?? "SOAP fault";
        const message = stringValue(fault.faultstring) ?? responsePreview(body);
        throw new NationalRailApiError(
          `National Rail operation ${request.operation} failed with ${code}: ${message}`,
        );
      }

      const responseNode = asRecord(asRecord(soapBody)?.[request.responseElement]);
      const result = responseNode?.[request.resultElement];
      if (result === undefined) {
        throw new NationalRailApiError(
          `National Rail operation ${request.operation} returned no ${request.resultElement} payload.`,
        );
      }

      return result as T;
    },
  };
}

function resolveValue(value: string | (() => string) | undefined): string {
  if (typeof value === "function") {
    return value().trim();
  }
  return value?.trim() ?? "";
}

function buildSoapEnvelope(accessToken: string, bodyXml: string): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"',
    ` xmlns:ldb="${NATIONAL_RAIL_LDB_NAMESPACE}"`,
    ` xmlns:tok="${NATIONAL_RAIL_TOKEN_NAMESPACE}">`,
    "<soap:Header>",
    "<tok:AccessToken>",
    `<tok:TokenValue>${xmlEscape(accessToken)}</tok:TokenValue>`,
    "</tok:AccessToken>",
    "</soap:Header>",
    `<soap:Body>${bodyXml}</soap:Body>`,
    "</soap:Envelope>",
  ].join("");
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

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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
