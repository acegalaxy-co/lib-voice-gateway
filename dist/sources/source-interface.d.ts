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
export declare abstract class IVoiceSource {
    /** @returns {"telegram"|"whatsapp"|"wechat"|"http"|"file"} */
    get source(): SourceType;
    /**
     * Fetch audio bytes from the source.
     * @param sourceData opaque per-source descriptor
     * @param opts
     */
    fetch(_sourceData: Record<string, unknown>, _opts: FetchOptions): Promise<FetchResult>;
}
//# sourceMappingURL=source-interface.d.ts.map