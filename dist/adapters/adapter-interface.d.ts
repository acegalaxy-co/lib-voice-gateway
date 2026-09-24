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
declare abstract class IVoiceAdapter {
    /** @returns {"whisper"|"gemini"|"local"} */
    get provider(): "whisper" | "gemini" | "local";
    /**
     * Transcribe an audio buffer.
     */
    abstract transcribe(buffer: Buffer, opts: TranscriptionOptions): Promise<TranscriptionResult>;
}
declare const _default: {
    IVoiceAdapter: typeof IVoiceAdapter;
};
export = _default;
//# sourceMappingURL=adapter-interface.d.ts.map