import http from "node:http";
import { captureSolution } from "./capture-solution.js";
import { resolveRootDir } from "./journal.js";

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end(JSON.stringify(body));
}

export function createCaptureServer(options = {}) {
  const rootDir = resolveRootDir(options);

  return http.createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && request.url === "/capture") {
      try {
        const payload = await readJsonBody(request);
        const result = await captureSolution(payload, { rootDir });
        sendJson(response, 200, result);
      } catch (error) {
        sendJson(response, 400, {
          ok: false,
          message: error instanceof Error ? error.message : "Unknown capture error"
        });
      }
      return;
    }

    sendJson(response, 404, {
      ok: false,
      message: "Not found"
    });
  });
}

export async function startCaptureServer(options = {}) {
  const port = options.port ?? 4444;
  const server = createCaptureServer(options);

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return server;
}
