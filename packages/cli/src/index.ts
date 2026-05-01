import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { buildPreviewUrl, explorerInputValues } from "@commute/shared/explorer/types";
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

Examples:
  commute-cli tfl list
  commute-cli tfl run stoppoint-search query="London Bridge Station" modes=bus,tube
  commute-cli tfl run line-status ids=jubilee,northern detail=true`);
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

async function main() {
  const parsed = parseCommand(process.argv.slice(2));
  if (!parsed || parsed.provider !== "tfl") {
    printUsage();
    process.exitCode = 1;
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
  const previewUrl = buildPreviewUrl(TFL_API_BASE, endpoint, values);
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

  console.error(`GET ${previewUrl}`);
  const { path: requestPath, params } = endpoint.buildPath(values);
  const data = await client.getJson<unknown>(requestPath, params);
  console.log(JSON.stringify(data, null, 2));
}

void main();
