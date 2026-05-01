import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type ProxyOptions } from "vite";

const keyFile = path.resolve(__dirname, "../../apikeys/tfl");

function readApiKey(): string {
  const envKey = process.env.TFL_API_KEY?.trim();
  if (envKey) {
    return envKey;
  }

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

const proxy: ProxyOptions = {
  target: "https://api.tfl.gov.uk",
  changeOrigin: true,
  secure: true,
  rewrite: (requestPath) => requestPath.replace(/^\/api\/tfl/, ""),
  configure: (proxyServer) => {
    proxyServer.on("proxyReq", (proxyReq) => {
      const apiKey = readApiKey();
      if (!apiKey) {
        return;
      }

      const originalPath = proxyReq.path ?? "/";
      const url = new URL(originalPath, "https://api.tfl.gov.uk");
      url.searchParams.set("app_key", apiKey);
      proxyReq.path = `${url.pathname}${url.search}`;
    });
  },
};

export default defineConfig({
  base: "./",
  define: {
    "import.meta.env.VITE_TFL_API_KEY": JSON.stringify(readApiKey()),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@commute/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api/tfl": proxy,
    },
  },
});
