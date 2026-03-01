/**
 * Universal API Relay — Vercel Serverless Function
 *
 * Proxies requests to any whitelisted upstream API so that clients behind
 * restrictive firewalls can access them via *.vercel.app.
 *
 * Targets are defined in /targets.json. To add a new upstream service,
 * just add a key-value pair there — no code changes needed.
 *
 * Usage:
 *   GET /api/proxy?target=gamma&path=/markets&limit=5
 *   GET /api/proxy?target=coingecko&path=/ping
 *   POST /api/proxy?target=binance&path=/api/v3/ticker/price&symbol=BTCUSDT
 *
 * Security:
 *   Set RELAY_API_KEY env var in Vercel to require authentication.
 *   Pass key via X-API-Key header or ?key= query param.
 *
 * Extra targets at runtime:
 *   Set RELAY_EXTRA_TARGETS env var as JSON to add targets without redeploying.
 *   Example: RELAY_EXTRA_TARGETS={"foo":"https://api.foo.com"}
 */

import targets from "../targets.json" assert { type: "json" };

function getTargets() {
  const merged = { ...targets };
  delete merged.__doc;

  const extra = process.env.RELAY_EXTRA_TARGETS;
  if (extra) {
    try {
      Object.assign(merged, JSON.parse(extra));
    } catch {
      console.error("Failed to parse RELAY_EXTRA_TARGETS env var");
    }
  }
  return merged;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Auth
  const apiKey = process.env.RELAY_API_KEY;
  if (apiKey) {
    const provided = req.headers["x-api-key"] || req.query.key;
    if (provided !== apiKey) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const allTargets = getTargets();
  const { target, path, key: _key, ...queryParams } = req.query;

  if (!target || !allTargets[target]) {
    return res.status(400).json({
      error: `Unknown target "${target || ""}"`,
      available: Object.keys(allTargets),
      usage: "GET /api/proxy?target=<name>&path=/endpoint&param=value",
    });
  }

  if (!path) {
    return res.status(400).json({
      error: "Missing 'path' parameter",
      usage: `GET /api/proxy?target=${target}&path=/endpoint`,
    });
  }

  const baseUrl = allTargets[target];
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const qs = new URLSearchParams(queryParams).toString();
  const upstreamUrl = `${baseUrl}${cleanPath}${qs ? `?${qs}` : ""}`;

  // Forward select headers from the original request
  const forwardHeaders = { "User-Agent": "APIRelay/1.0" };
  if (req.headers["content-type"]) {
    forwardHeaders["Content-Type"] = req.headers["content-type"];
  }
  if (req.headers["authorization"]) {
    forwardHeaders["Authorization"] = req.headers["authorization"];
  }

  try {
    const fetchOpts = {
      method: req.method,
      headers: forwardHeaders,
    };
    if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
      fetchOpts.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    }

    const upstreamRes = await fetch(upstreamUrl, fetchOpts);
    const contentType = upstreamRes.headers.get("content-type") || "";

    // Forward upstream status code
    if (contentType.includes("application/json")) {
      const data = await upstreamRes.json();
      return res.status(upstreamRes.status).json(data);
    }

    const text = await upstreamRes.text();
    res.setHeader("Content-Type", contentType || "text/plain");
    return res.status(upstreamRes.status).send(text);
  } catch (err) {
    console.error(`Relay error [${target}]: ${err.message}`);
    return res.status(502).json({
      error: "Upstream request failed",
      target,
      detail: err.message,
    });
  }
}
