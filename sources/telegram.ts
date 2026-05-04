"use strict";
const { IVoiceSource } = require("./source-interface");

const TG_API = "https://api.telegram.org";

// OpenAI Whisper-compat /audio/transcriptions only accepts these extensions:
//   flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
// Telegram voice files come back as ".oga" which OpenAI sometimes rejects with
// "Unsupported file format oga" — normalize to ".ogg" for voice.
function _normalizeFilename(filePath: string, mimeType: string, isVoice: boolean): string {
  const rawExt = (filePath.split(".").pop() || "").toLowerCase();
  if (isVoice || mimeType === "audio/ogg" || rawExt === "oga") return "voice.ogg";
  if (rawExt && rawExt.length <= 5) return `voice.${rawExt}`;
  return "voice.ogg";
}

interface AudioSourceResult {
  fileId: string;
  mimeType: string;
  isVoice: boolean;
  durationSec: number;
}

// Telegram message → fileId/mimeType/duration. Supports voice (OGG/Opus) + audio (mp3/m4a).
function pickAudioSource(msg: Record<string, unknown>): AudioSourceResult | null {
  const voice = msg?.voice as Record<string, unknown> | undefined;
  if (voice?.file_id) {
    return {
      fileId: voice.file_id as string,
      mimeType: (voice.mime_type as string) || "audio/ogg",
      isVoice: true,
      durationSec: voice.duration as number,
    };
  }
  const audio = msg?.audio as Record<string, unknown> | undefined;
  if (audio?.file_id) {
    return {
      fileId: audio.file_id as string,
      mimeType: (audio.mime_type as string) || "audio/mpeg",
      isVoice: false,
      durationSec: audio.duration as number,
    };
  }
  return null;
}

interface SourceData {
  botToken?: string;
  fileId?: string;
  isVoice?: boolean;
  mimeType?: string;
  durationSec?: number;
}

interface FetchOptions {
  maxBytes?: number;
}

interface FetchResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  durationSec?: number;
  isVoice: boolean;
}

class TelegramSource extends IVoiceSource {
  get source(): string {
    return "telegram";
  }

  async fetch(sourceData: SourceData, opts: FetchOptions = {}): Promise<FetchResult> {
    if (!sourceData?.botToken) throw new Error("telegram: sourceData.botToken required");
    if (!sourceData?.fileId) throw new Error("telegram: sourceData.fileId required");
    const maxBytes = opts.maxBytes || 10 * 1024 * 1024;

    // 1. getFile → file_path
    const metaResp = await fetch(`${TG_API}/bot${sourceData.botToken}/getFile?file_id=${encodeURIComponent(sourceData.fileId)}`);
    if (!metaResp.ok) throw new Error(`telegram getFile HTTP ${metaResp.status}`);
    const meta = await metaResp.json() as { ok?: boolean; result?: { file_path?: string } };
    if (!meta?.ok || !meta.result?.file_path) {
      throw new Error(`telegram getFile failed: ${JSON.stringify(meta).slice(0, 200)}`);
    }
    const filePath = meta.result.file_path;

    // 2. download with size limit
    const dlUrl = `${TG_API}/file/bot${sourceData.botToken}/${filePath}`;
    const dlResp = await fetch(dlUrl);
    if (!dlResp.ok) throw new Error(`telegram download HTTP ${dlResp.status}`);

    const arrBuf = await dlResp.arrayBuffer();
    const buffer = Buffer.from(arrBuf);
    if (buffer.length > maxBytes) {
      throw Object.assign(new Error(`telegram: file too large ${buffer.length} > ${maxBytes}`), { code: "TOO_LARGE" });
    }

    const isVoice = sourceData.isVoice !== false; // default true
    const mimeType = sourceData.mimeType || (isVoice ? "audio/ogg" : "audio/mpeg");
    const filename = _normalizeFilename(filePath, mimeType, isVoice);

    return {
      buffer,
      mimeType,
      filename,
      durationSec: sourceData.durationSec,
      isVoice,
    };
  }
}

function create(): TelegramSource {
  return new TelegramSource();
}

export = { create, TelegramSource, pickAudioSource };