// voice-gateway/smoke.test.js
// Smoke test — exercises L2/L3/L4 + queue without hitting real STT/Telegram.
// Run: node ace_commons/voice-gateway-nodejs/smoke.test.js
//
// Pass criteria: all 7 cases print PASS. Exit code 0 = green.

const assert = require("assert");
const gw = require("./index");
const queue = require("./queue/in-memory");

let failed = 0;
function expect(label, cond, detail) {
  const status = cond ? "PASS" : "FAIL";
  // eslint-disable-next-line no-console
  console.log(`  [${status}] ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failed++;
}

(async () => {
  console.log("voice-gateway smoke test\n");

  // 1. L2 — missing caller
  console.log("L2 — Identity");
  let r = await gw.transcribe({ source: "telegram", sourceData: {} }, null);
  expect("null caller → denied:L2", r.outcome === "denied" && r.denyReason === "L2_unknown_caller", r.denyReason);

  r = await gw.transcribe({ source: "telegram", sourceData: {} }, { service: "x" });
  expect("missing scope → denied:L2", r.outcome === "denied" && r.denyReason === "L2_unknown_caller", r.denyReason);

  // 2. L3 — bad source
  console.log("\nL3 — Authz");
  r = await gw.transcribe({ source: "facebook", sourceData: {} }, { service: "x", scope: "y" });
  expect("unknown source → denied:L3", r.outcome === "denied" && r.denyReason === "L3_authz", r.denyReason);

  r = await gw.transcribe({ source: "telegram", sourceData: {}, provider: "fake" }, { service: "x", scope: "y" });
  expect("unknown provider → denied:L3", r.outcome === "denied" && r.denyReason === "L3_authz", r.denyReason);

  // 3. L1 — telegram source given bad data → triggers source error
  console.log("\nL1 — Source error path");
  r = await gw.transcribe(
    { source: "telegram", sourceData: { botToken: "bad", fileId: "bad" }, skipQueue: true },
    { service: "test", scope: "test" },
  );
  expect("invalid telegram → outcome:error", r.outcome === "error", `${r.outcome}/${r.denyReason}`);

  // 4. Queue — concurrency cap
  console.log("\nQ — Queue concurrency");
  const before = queue.stats();
  expect("queue reports stats shape", typeof before.maxConcurrent === "number", JSON.stringify(before));

  // 5. Queue — work executes in order, max-concurrent honored
  let active = 0;
  let peak = 0;
  const work = (ms) => async () => {
    active++;
    if (active > peak) peak = active;
    await new Promise((r) => setTimeout(r, ms));
    active--;
    return ms;
  };
  const tasks = await Promise.all(
    Array.from({ length: 6 }, () => queue.enqueue(work(60))),
  );
  const results = await Promise.all(tasks.map((t) => t.result));
  expect("6 tasks all completed", results.length === 6 && results.every((v) => v === 60));
  expect(`peak concurrency ≤ MAX_CONCURRENT (${queue.MAX_CONCURRENT})`, peak <= queue.MAX_CONCURRENT, `peak=${peak}`);

  // 6. Audit log appended (at least one record)
  console.log("\nL5 — Audit");
  const fs = require("fs");
  const path = require("path");
  const auditPath = path.join(__dirname, "audit/audit.log");
  const exists = fs.existsSync(auditPath);
  expect("audit.log exists after run", exists, auditPath);
  if (exists) {
    const lines = fs.readFileSync(auditPath, "utf8").trim().split("\n").filter(Boolean);
    expect("audit has ≥5 records", lines.length >= 5, `lines=${lines.length}`);
    try {
      const last = JSON.parse(lines[lines.length - 1]);
      expect("last record has shape", last.ts && last.outcome && typeof last.latencyMs === "number");
    } catch (e) {
      expect("last record is valid JSON", false, e.message);
    }
  }

  console.log(`\n${failed === 0 ? "✅ ALL PASS" : "❌ " + failed + " FAILED"}`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
