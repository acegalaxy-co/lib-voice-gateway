"use strict";
const ALLOWED_SOURCES = new Set(["telegram", "whatsapp", "wechat", "http", "file"]);
const ALLOWED_PROVIDERS = new Set(["whisper", "gemini", "local"]);
/**
 * @param caller - The caller requesting transcription
 * @param request - The transcription request details
 * @returns Promise resolving to authorization result
 */
async function check(caller, request) {
    if (!request || !request.source || !request.sourceData) {
        return { allow: false, reason: "L3_authz" };
    }
    if (!ALLOWED_SOURCES.has(request.source)) {
        return { allow: false, reason: "L3_authz" };
    }
    const provider = request.provider || "whisper";
    if (!ALLOWED_PROVIDERS.has(provider)) {
        return { allow: false, reason: "L3_authz" };
    }
    // Phase 2: per-service policy YAML — e.g. nexus-bot may use telegram+whisper only,
    // wa-bot may use whatsapp+whisper, web-app may use http+gemini.
    return { allow: true };
}
module.exports = { check, ALLOWED_SOURCES, ALLOWED_PROVIDERS };
//# sourceMappingURL=engine.js.map