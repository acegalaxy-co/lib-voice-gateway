"use strict";
const path = require("path");
// @ts-expect-error — TS migration: type unverified, fix when polishing
const audit_log_1 = require("@acegalaxy/lib-security-utils/audit-log");
const logger = (0, audit_log_1.createAuditLogger)({
    logPath: path.join(__dirname, "audit.log"),
    tag: "voice-gateway audit",
    mode: "sync",
});
module.exports = { record: logger.record, LOG_PATH: logger.LOG_PATH };
//# sourceMappingURL=logger.js.map