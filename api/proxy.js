/**
 * Vercel Serverless Function — Polymarket API Relay
 *
 * Proxies requests to Polymarket APIs (gamma, clob, data) so that
 * clients behind restrictive firewalls can access them via *.vercel.app.
 *
 * Usage:
 *   GET /api/proxy?target=gamma&path=/markets&limit=5
 *   GET /api/proxy?target=clob&path=/midpoint&token_id=xxx
 *   GET /api/proxy?target=data&path=/trades&user=0x...
 *
 * Security: requests must include a valid API_KEY header or query param.
 */

const TARGETS = {
  gamma: "https://gamma-api.polymarket.com",
  clob: "https://clob.polymarket.com",
  data: "https://data-api.polymarket.com",
};

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Auth check
  const apiKey = process.env.RELAY_API_KEY;
  if (apiKey) {
    const provided =
      req.headers["x-api-key"] || req.query.key;
    if (provided !== apiKey) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const { target, path, ...queryParams } = req.query;

  if (!target || !TARGETS[target]) {
    return res.status(400).json({
      error: `Invalid target. Must be one of: ${Object.keys(TARGETS).join(", ")}`,
      usage: "GET /api/proxy?target=gamma&path=/markets&limit=5",
    });
  }

  if (!path) {
    return res.status(400).json({
      error: "Missing 'path' parameter",
      usage: "GET /api/proxy?target=gamma&path=/markets&limit=5",
    });
  }

  // Build upstream URL
  const baseUrl = TARGETS[target];
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // Forward remaining query params (exclude target, path, key)
  const forwardParams = { ...queryParams };
  delete forwardParams.key;
  const qs = new URLSearchParams(forwardParams).toString();
  const upstreamUrl = `${baseUrl}${cleanPath}${qs ? `?${qs}` : ""}`;

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: req.method === "POST" ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "PolymarketRelay/1.0",
      },
      body: req.method === "POST" ? JSON.stringify(req.body) : undefined,
    });

    const contentType = upstreamRes.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await upstreamRes.json();
      return res.status(upstreamRes.status).json(data);
    }

    const text = await upstreamRes.text();
    return res.status(upstreamRes.status).send(text);
  } catch (err) {
    console.error(`Relay error: ${err.message}`);
    return res.status(502).json({
      error: "Upstream request failed",
      detail: err.message,
      upstream: upstreamUrl,
    });
  }
}
