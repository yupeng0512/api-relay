import targets from "../targets.json" assert { type: "json" };

export default function handler(req, res) {
  const allTargets = { ...targets };
  delete allTargets.__doc;

  const extra = process.env.RELAY_EXTRA_TARGETS;
  if (extra) {
    try { Object.assign(allTargets, JSON.parse(extra)); } catch {}
  }

  res.status(200).json({
    status: "ok",
    service: "api-relay",
    timestamp: new Date().toISOString(),
    targets: Object.keys(allTargets),
  });
}
