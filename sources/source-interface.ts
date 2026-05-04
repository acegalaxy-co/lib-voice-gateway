"use strict";

// voice-gateway/sources/source-interface.ts
// Abstract input source. Each platform (Telegram/WhatsApp/WeChat/HTTP/file) implements this.
// Source's only job: deliver { buffer, mimeType, filename, durationSec, isVoice } from the
// platform-specific descriptor. Source never sees Caller and never makes STT calls.

export interface FetchResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  durationSec?: number;
  isVoice?: boolean;
}

export interface FetchOptions {
  maxBytes: number;
}

export type SourceType = "telegram" | "whatsapp" | "wechat" | "http" | "file";

export abstract class IVoiceSource {
  /** @returns {"telegram"|"whatsapp"|"wechat"|"http"|"file"} */
  get source(): SourceType {
    throw new Error("abstract: source");
  }

  /**
   * Fetch audio bytes from the source.
   * @param sourceData opaque per-source descriptor
   * @param opts
   */
  async fetch(
    _sourceData: Record<string, unknown>,
    _opts: FetchOptions
  ): Promise<FetchResult> {
    throw new Error("abstract: fetch");
  }
}

