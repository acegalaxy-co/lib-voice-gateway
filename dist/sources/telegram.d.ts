declare const IVoiceSource: any;
interface AudioSourceResult {
    fileId: string;
    mimeType: string;
    isVoice: boolean;
    durationSec: number;
}
declare function pickAudioSource(msg: Record<string, unknown>): AudioSourceResult | null;
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
declare class TelegramSource extends IVoiceSource {
    get source(): string;
    fetch(sourceData: SourceData, opts?: FetchOptions): Promise<FetchResult>;
}
declare function create(): TelegramSource;
declare const _default: {
    create: typeof create;
    TelegramSource: typeof TelegramSource;
    pickAudioSource: typeof pickAudioSource;
};
export = _default;
//# sourceMappingURL=telegram.d.ts.map