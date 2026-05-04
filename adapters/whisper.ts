"use strict";
const { IVoiceAdapter } = require("./adapter-interface");

// Whisper pricing (OpenAI gpt-4o-mini-transcribe, 2026-04 estimate).
// Cost = $0.006 / minute. Adjust if env override.
const COST_PER_MINUTE_USD: number = Number(process.env.VOICE_GW_WHISPER_USD_PER_MIN || 0.006);

interface TranscribeOptions {
  mimeType?: string;
  filename?: string;
  language?: string;
  durationSec?: number;
}

interface TranscribeResult {
  text: string;
  model: string;
  costUsd: number | undefined;
}

class WhisperAdapter extends IVoiceAdapter {
  private model: string;
  private baseUrl: string;
  private apiKeyEnv: string;

  constructor() {
    super();
    this.model = process.env.VOICE_GW_WHISPER_MODEL || "gpt-4o-mini-transcribe";
    this.baseUrl = process.env.VOICE_GW_WHISPER_BASE_URL || "https://api.openai.com/v1";
    this.apiKeyEnv = process.env.VOICE_GW_WHISPER_API_KEY_ENV || "OPENAI_API_KEY";
  }

  get provider(): string {
    return "whisper";
  }

  private _getApiKey(): string {
    const key: string | undefined = process.env[this.apiKeyEnv];
    if (!key) throw new Error(`whisper: env ${this.apiKeyEnv} not set`);
    return key;
  }

  async transcribe(buffer: Buffer, opts: TranscribeOptions = {}): Promise<TranscribeResult> {
    if (!Buffer.isBuffer(buffer)) throw new Error("whisper: buffer required");
    const apiKey: string = this._getApiKey();
    const form: FormData = new FormData();
    const blob: Blob = new Blob([buffer], { type: opts.mimeType || "audio/ogg" });
    form.append("file", blob, opts.filename || "voice.ogg");
    form.append("model", this.model);
    if (opts.language && opts.language !== "auto") form.append("language", opts.language);
    form.append("response_format", "json");

    const url: string = `${this.baseUrl.replace(/\/$/, "")}/audio/transcriptions`;
    const resp: Response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!resp.ok) {
      const errText: string = await resp.text().catch(() => "");
      throw new Error(`whisper HTTP ${resp.status}: ${errText.slice(0, 200)}`);
    }
    const data: { text?: string } = await resp.json() as { text?: string };
    const text: string = (data?.text || "").trim();
    if (!text) throw new Error("whisper: empty transcript");

    const durationSec: number = opts.durationSec || 0;
    const costUsd: number | undefined = durationSec ? (durationSec / 60) * COST_PER_MINUTE_USD : undefined;
    return { text, model: this.model, costUsd };
  }
}

function create(): WhisperAdapter {
  return new WhisperAdapter();
}

export = { create, WhisperAdapter };