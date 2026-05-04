"use strict";

// voice-gateway/adapters/adapter-interface.ts
// Abstract STT provider interface. Every adapter MUST implement this.
// L1-3 already passed; adapter trusts request shape and never sees Caller.

interface TranscriptionOptions {
  mimeType: string;
  filename?: string;
  language?: string;
}

interface TranscriptionResult {
  text: string;
  model: string;
  costUsd?: number;
}

abstract class IVoiceAdapter {
  /** @returns {"whisper"|"gemini"|"local"} */
  get provider(): "whisper" | "gemini" | "local" {
    throw new Error("abstract: provider");
  }

  /**
   * Transcribe an audio buffer.
   */
  abstract transcribe(
    buffer: Buffer,
    opts: TranscriptionOptions
  ): Promise<TranscriptionResult>;
}

export = { IVoiceAdapter };