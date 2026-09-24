declare const IVoiceAdapter: any;
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
declare class WhisperAdapter extends IVoiceAdapter {
    private model;
    private baseUrl;
    private apiKeyEnv;
    constructor();
    get provider(): string;
    private _getApiKey;
    transcribe(buffer: Buffer, opts?: TranscribeOptions): Promise<TranscribeResult>;
}
declare function create(): WhisperAdapter;
declare const _default: {
    create: typeof create;
    WhisperAdapter: typeof WhisperAdapter;
};
export = _default;
//# sourceMappingURL=whisper.d.ts.map