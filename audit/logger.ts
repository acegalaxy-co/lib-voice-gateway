"use strict";

import path = require("path");
// @ts-expect-error — TS migration: type unverified, fix when polishing
import { createAuditLogger } from "../../security-utils-nodejs/audit-log";

const logger: ReturnType<typeof createAuditLogger> = createAuditLogger({
  logPath: path.join(__dirname, "audit.log"),
  tag: "voice-gateway audit",
  mode: "sync",
});

export = { record: logger.record, LOG_PATH: logger.LOG_PATH };