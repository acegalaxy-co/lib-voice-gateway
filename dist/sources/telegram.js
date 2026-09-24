"use strict";
const { IVoiceSource } = require("./source-interface");
const TG_API = "https://api.telegram.org";
// OpenAI Whisper-compat /audio/transcriptions only accepts these extensions:
//   flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
// Telegram voice files come back as ".oga" which OpenAI sometimes rejects with
// "Unsupported file format oga" — normalize to ".ogg" for voice.
function _normalizeFilename(filePath, mimeType, isVoice) {
    const rawExt = (filePath.split(".").pop() || "").toLowerCase();
    if (isVoice || mimeType === "audio/ogg" || rawExt === "oga")
        return "voice.ogg";
    if (rawExt && rawExt.length <= 5)
        return `voice.${rawExt}`;
    return "voice.ogg";
}
// Telegram message → fileId/mimeType/duration. Supports voice (OGG/Opus) + audio (mp3/m4a).
function pickAudioSource(msg) {
    const voice = msg?.voice;
    if (voice?.file_id) {
        return {
            fileId: voice.file_id,
            mimeType: voice.mime_type || "audio/ogg",
            isVoice: true,
            durationSec: voice.duration,
        };
    }
    const audio = msg?.audio;
    if (audio?.file_id) {
        return {
            fileId: audio.file_id,
            mimeType: audio.mime_type || "audio/mpeg",
            isVoice: false,
            durationSec: audio.duration,
        };
    }
    return null;
}
class TelegramSource extends IVoiceSource {
    get source() {
        return "telegram";
    }
    async fetch(sourceData, opts = {}) {
        if (!sourceData?.botToken)
            throw new Error("telegram: sourceData.botToken required");
        if (!sourceData?.fileId)
            throw new Error("telegram: sourceData.fileId required");
        const maxBytes = opts.maxBytes || 10 * 1024 * 1024;
        // 1. getFile → file_path
        const metaResp = await fetch(`${TG_API}/bot${sourceData.botToken}/getFile?file_id=${encodeURIComponent(sourceData.fileId)}`);
        if (!metaResp.ok)
            throw new Error(`telegram getFile HTTP ${metaResp.status}`);
        const meta = await metaResp.json();
        if (!meta?.ok || !meta.result?.file_path) {
            throw new Error(`telegram getFile failed: ${JSON.stringify(meta).slice(0, 200)}`);
        }
        const filePath = meta.result.file_path;
        // 2. download with size limit
        const dlUrl = `${TG_API}/file/bot${sourceData.botToken}/${filePath}`;
        const dlResp = await fetch(dlUrl);
        if (!dlResp.ok)
            throw new Error(`telegram download HTTP ${dlResp.status}`);
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
function create() {
    return new TelegramSource();
}
module.exports = { create, TelegramSource, pickAudioSource };
//# sourceMappingURL=telegram.js.map