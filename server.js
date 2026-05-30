const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;
const SERVICES = {
  gateway: process.env.GATEWAY_URL || "http://localhost:8080"
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  });
  res.end(body);
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(ROOT, requested));

  if (!filePath.startsWith(ROOT)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }

    const type = contentTypes[path.extname(filePath)] || "application/octet-stream";
    send(res, 200, data, type);
  });
}

function proxy(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const service = url.searchParams.get("service") || "gateway";
  const targetPath = url.searchParams.get("path") || "/";
  const requestedBase = url.searchParams.get("base");
  const base = requestedBase || SERVICES[service];

  if (!base || !/^https?:\/\//.test(base)) {
    send(res, 400, JSON.stringify({ error: "Unknown service" }));
    return;
  }

  const target = new URL(targetPath, base);
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers["content-length"];

  const chunks = [];
  req.on("data", chunk => chunks.push(chunk));
  req.on("end", async () => {
    try {
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const response = await fetch(target, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : body
      });

      const text = await response.text();
      send(
        res,
        response.status,
        text,
        response.headers.get("content-type") || "text/plain; charset=utf-8"
      );
    } catch (error) {
      send(res, 502, JSON.stringify({
        error: "Service request failed",
        service,
        target: target.toString(),
        message: error.message
      }));
    }
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 204, "");
    return;
  }

  if (req.url.startsWith("/proxy")) {
    proxy(req, res);
    return;
  }

  if (req.url === "/config") {
    send(res, 200, JSON.stringify(SERVICES));
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`YourOrder test UI: http://${HOST}:${PORT}`);
  console.log(`gateway=${SERVICES.gateway}`);
});
