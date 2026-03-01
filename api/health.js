const fs = require("fs");
const path = require("path");

module.exports = function handler(req, res) {
  const raw = fs.readFileSync(path.join(__dirname, "..", "targets.json"), "utf-8");
  const allTargets = JSON.parse(raw);
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
};
