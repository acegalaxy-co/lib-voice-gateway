"use strict";
const { IVoiceAdapter } = require("./adapter-interface");
// Whisper pricing (OpenAI gpt-4o-mini-transcribe, 2026-04 estimate).
// Cost = $0.006 / minute. Adjust if env override.
const COST_PER_MINUTE_USD = Number(process.env.VOICE_GW_WHISPER_USD_PER_MIN || 0.006);
class WhisperAdapter extends IVoiceAdapter {
    model;
    baseUrl;
    apiKeyEnv;
    constructor() {
        super();
        this.model = process.env.VOICE_GW_WHISPER_MODEL || "gpt-4o-mini-transcribe";
        this.baseUrl = process.env.VOICE_GW_WHISPER_BASE_URL || "https://api.openai.com/v1";
        this.apiKeyEnv = process.env.VOICE_GW_WHISPER_API_KEY_ENV || "OPENAI_API_KEY";
    }
    get provider() {
        return "whisper";
    }
    _getApiKey() {
        const key = process.env[this.apiKeyEnv];
        if (!key)
            throw new Error(`whisper: env ${this.apiKeyEnv} not set`);
        return key;
    }
    async transcribe(buffer, opts = {}) {
        if (!Buffer.isBuffer(buffer))
            throw new Error("whisper: buffer required");
        const apiKey = this._getApiKey();
        const form = new FormData();
        const blob = new Blob([buffer], { type: opts.mimeType || "audio/ogg" });
        form.append("file", blob, opts.filename || "voice.ogg");
        form.append("model", this.model);
        if (opts.language && opts.language !== "auto")
            form.append("language", opts.language);
        form.append("response_format", "json");
        const url = `${this.baseUrl.replace(/\/$/, "")}/audio/transcriptions`;
        const resp = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form,
        });
        if (!resp.ok) {
            const errText = await resp.text().catch(() => "");
            throw new Error(`whisper HTTP ${resp.status}: ${errText.slice(0, 200)}`);
        }
        const data = await resp.json();
        const text = (data?.text || "").trim();
        if (!text)
            throw new Error("whisper: empty transcript");
        const durationSec = opts.durationSec || 0;
        const costUsd = durationSec ? (durationSec / 60) * COST_PER_MINUTE_USD : undefined;
        return { text, model: this.model, costUsd };
    }
}
function create() {
    return new WhisperAdapter();
}
module.exports = { create, WhisperAdapter };
//# sourceMappingURL=whisper.js.map