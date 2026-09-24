interface TranscribeRequest {
    source?: string;
    provider?: string;
    sourceData?: unknown;
    maxBytes?: number;
    language?: string;
    skipQueue?: boolean;
}
interface Caller {
    service?: string;
    scope?: string;
    userId?: string;
}
interface TranscribeResult {
    outcome: string;
    denyReason: string | null;
    latencyMs: number;
    errorMessage?: string;
    text?: string;
    model?: string;
    durationSec?: number;
    bytes?: number;
    costUsd?: number;
}
/**
 * Dispatch a transcription request through all gateway layers.
 * Never throws — returns { outcome, denyReason, text?, ... }.
 *
 * @param request
 * @param caller
 * @returns
 */
declare function transcribe(request: TranscribeRequest, caller: Caller): Promise<TranscribeResult>;
declare function queueStats(): unknown;
declare const _default: {
    transcribe: typeof transcribe;
    queueStats: typeof queueStats;
};
export = _default;
//# sourceMappingURL=index.d.ts.map