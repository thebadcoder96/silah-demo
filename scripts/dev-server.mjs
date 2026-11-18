// Local stand-in for Vercel: serves the static site and the functions in api/.
// Usage: node scripts/dev-server.mjs   (PORT env var optional, default 5174)

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Same .env the setup scripts use, so functions that need a key work locally.
try {
  const env = await readFile(new URL("../.env", import.meta.url), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {
  // no .env file
}

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT || 5174);
// Add each new function here: path -> module.
const API = {
  "/api/queue": (await import("../api/queue.js")).default,
};
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);

  const handler = API[url.pathname];
  if (handler) {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    req.query = Object.fromEntries(url.searchParams);
    req.body = raw;
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (obj) => {
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.setHeader("cache-control", "no-store");
      res.end(JSON.stringify(obj));
    };
    return handler(req, res);
  }

  const rel = decodeURIComponent(url.pathname.slice(1)) || "index.html";
  let file = normalize(join(root, rel));
  if (file !== root && !file.startsWith(root + sep)) {
    res.statusCode = 403;
    return res.end("forbidden");
  }
  if (rel.startsWith(".") || rel.includes("/.")) {
    res.statusCode = 404;
    return res.end("not found");
  }
  try {
    if ((await stat(file)).isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        res.statusCode = 301;
        res.setHeader("location", url.pathname + "/");
        return res.end();
      }
      file = join(file, "index.html");
    }
    const data = await readFile(file);
    res.setHeader("content-type", MIME[extname(file)] || "application/octet-stream");
    res.setHeader("cache-control", "no-store");
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end("not found");
  }
}).listen(port, () => console.log(`Silah demo running at http://localhost:${port}`));
