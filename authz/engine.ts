"use strict";

const ALLOWED_SOURCES: ReadonlySet<string> = new Set(["telegram", "whatsapp", "wechat", "http", "file"]);
const ALLOWED_PROVIDERS: ReadonlySet<string> = new Set(["whisper", "gemini", "local"]);

interface Caller {
  // Placeholder for Caller type — expand as needed
  [key: string]: unknown;
}

interface TranscribeRequest {
  source?: string;
  sourceData?: unknown;
  provider?: string;
  [key: string]: unknown;
}

interface AuthzResult {
  allow: boolean;
  reason?: string;
}

/**
 * @param caller - The caller requesting transcription
 * @param request - The transcription request details
 * @returns Promise resolving to authorization result
 */
async function check(caller: Caller, request: TranscribeRequest): Promise<AuthzResult> {
  if (!request || !request.source || !request.sourceData) {
    return { allow: false, reason: "L3_authz" };
  }
  if (!ALLOWED_SOURCES.has(request.source)) {
    return { allow: false, reason: "L3_authz" };
  }
  const provider: string = request.provider || "whisper";
  if (!ALLOWED_PROVIDERS.has(provider)) {
    return { allow: false, reason: "L3_authz" };
  }

  // Phase 2: per-service policy YAML — e.g. nexus-bot may use telegram+whisper only,
  // wa-bot may use whatsapp+whisper, web-app may use http+gemini.
  return { allow: true };
}

export = { check, ALLOWED_SOURCES, ALLOWED_PROVIDERS };