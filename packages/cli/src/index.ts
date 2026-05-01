import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { explorerInputValues } from "@commute/shared/explorer/types";
import {
  createNationalRailClient,
  NATIONAL_RAIL_ENDPOINT,
} from "@commute/shared/nationalRail/client";
import {
  NATIONAL_RAIL_RPC_GROUPS,
  NATIONAL_RAIL_RPCS,
  nationalRailInputValues,
} from "@commute/shared/nationalRail/rpc";
import { createTflClient } from "@commute/shared/tfl/client";
import {
  EXPLORER_ENDPOINT_GROUPS,
  EXPLORER_ENDPOINTS,
  TFL_API_BASE,
} from "@commute/shared/tfl/explorer";

type Command = "list" | "run";

function printUsage() {
  console.log(`Usage:
  commute-cli tfl list
  commute-cli tfl run <endpoint-id> [key=value ...]
  commute-cli national-rail list
  commute-cli national-rail run <rpc-id> [key=value ...]

Examples:
  commute-cli tfl list
  commute-cli tfl run stoppoint-search query="London Bridge Station" modes=bus,tube
  commute-cli tfl run line-status ids=jubilee,northern detail=true
  commute-cli national-rail list
  commute-cli national-rail run departure-board crs=KGX numRows=6
  commute-cli national-rail run next-departures crs=KGX filterList=CBG,EDB`);
}

function parseCommand(argv: string[]): { command: Command; provider: string; args: string[] } | null {
  const [provider, command, ...args] = argv;
  if ((command === "list" || command === "run") && provider) {
    return { command, provider, args };
  }
  return null;
}

function parseKeyValues(args: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const arg of args) {
    const index = arg.indexOf("=");
    if (index <= 0) {
      continue;
    }
    values[arg.slice(0, index)] = arg.slice(index + 1);
  }
  return values;
}

function readTflApiKey(): string {
  const envKey = process.env.TFL_API_KEY?.trim();
  if (envKey) {
    return envKey;
  }

  const keyFile = path.resolve(process.cwd(), "apikeys/tfl");
  if (!fs.existsSync(keyFile)) {
    return "";
  }

  const raw = fs.readFileSync(keyFile, "utf8").trim();
  if (raw.includes("=")) {
    const params = new URLSearchParams(raw.replace(/\n/g, "&"));
    return params.get("app_key")?.trim() ?? raw;
  }

  return raw.replace(/^["']|["']$/g, "").trim();
}

function readNationalRailToken(): string {
  const envToken = process.env.NATIONAL_RAIL_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }

  const candidateFiles = [
    path.resolve(process.cwd(), "apikeys/national-rail"),
    path.resolve(process.cwd(), "apikeys/nre"),
  ];

  for (const file of candidateFiles) {
    if (!fs.existsSync(file)) {
      continue;
    }
    const raw = fs.readFileSync(file, "utf8").trim();
    if (!raw) {
      continue;
    }
    if (raw.includes("=")) {
      const params = new URLSearchParams(raw.replace(/\n/g, "&"));
      const token =
        params.get("token")?.trim() ??
        params.get("accessToken")?.trim() ??
        params.get("TokenValue")?.trim();
      if (token) {
        return token;
      }
    }
    return raw.replace(/^["']|["']$/g, "").trim();
  }

  return "";
}

async function main() {
  const parsed = parseCommand(process.argv.slice(2));
  if (!parsed || !["tfl", "national-rail", "nre", "nr"].includes(parsed.provider)) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (parsed.provider === "national-rail" || parsed.provider === "nre" || parsed.provider === "nr") {
    if (parsed.command === "list") {
      const rpcById = Object.fromEntries(NATIONAL_RAIL_RPCS.map((rpc) => [rpc.id, rpc]));
      for (const group of NATIONAL_RAIL_RPC_GROUPS) {
        console.log(`\n${group.label}`);
        for (const rpcId of group.rpcIds) {
          const rpc = rpcById[rpcId];
          console.log(`  ${rpc.id}  ${rpc.description}`);
        }
      }
      return;
    }

    const [rpcId, ...kvArgs] = parsed.args;
    if (!rpcId) {
      printUsage();
      process.exitCode = 1;
      return;
    }

    const rpc = NATIONAL_RAIL_RPCS.find((candidate) => candidate.id === rpcId);
    if (!rpc) {
      console.error(`Unknown National Rail RPC: ${rpcId}`);
      process.exitCode = 1;
      return;
    }

    const token = readNationalRailToken();
    if (!token) {
      console.error(
        "No National Rail token found. Set NATIONAL_RAIL_TOKEN or create apikeys/nre.",
      );
      process.exitCode = 1;
      return;
    }

    const values = nationalRailInputValues(rpc, parseKeyValues(kvArgs));
    const client = createNationalRailClient({
      endpoint: NATIONAL_RAIL_ENDPOINT,
      accessToken: token,
      fetchFn: async (input, init) => fetch(input, init),
    });

    const request = rpc.request(values);
    const result = await client.call<unknown>(request);
    console.log(JSON.stringify(rpc.normalize(result), null, 2));
    return;
  }

  if (parsed.command === "list") {
    for (const group of EXPLORER_ENDPOINT_GROUPS) {
      console.log(`\n${group.label}`);
      for (const endpoint of group.endpoints) {
        console.log(`  ${endpoint.id}  ${endpoint.description}`);
      }
    }
    return;
  }

  const [endpointId, ...kvArgs] = parsed.args;
  if (!endpointId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const endpoint = EXPLORER_ENDPOINTS.find((candidate) => candidate.id === endpointId);
  if (!endpoint) {
    console.error(`Unknown TfL endpoint: ${endpointId}`);
    process.exitCode = 1;
    return;
  }

  const values = explorerInputValues(endpoint, parseKeyValues(kvArgs));
  const apiKey = readTflApiKey();

  if (!apiKey) {
    console.error("No TfL API key found. Set TFL_API_KEY or create apikeys/tfl.");
    process.exitCode = 1;
    return;
  }

  const client = createTflClient({
    apiBase: TFL_API_BASE,
    apiKey,
    fetchFn: async (input, init) => fetch(input, init),
  });

  const { path: requestPath, params } = endpoint.buildPath(values);
  const data = await client.getJson<unknown>(requestPath, params);
  console.log(JSON.stringify(data, null, 2));
}

void main();
