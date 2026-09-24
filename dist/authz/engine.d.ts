interface Caller {
    [key: string]: unknown;
}
interface TranscribeRequest {
    source?: string;
    sourceData?: unknown;
    provider?: string;
    [key: string]: unknown;
}
interface AuthzResult {
    allow: boolean;
    reason?: string;
}
/**
 * @param caller - The caller requesting transcription
 * @param request - The transcription request details
 * @returns Promise resolving to authorization result
 */
declare function check(caller: Caller, request: TranscribeRequest): Promise<AuthzResult>;
declare const _default: {
    check: typeof check;
    ALLOWED_SOURCES: ReadonlySet<string>;
    ALLOWED_PROVIDERS: ReadonlySet<string>;
};
export = _default;
//# sourceMappingURL=engine.d.ts.map