/**
 * @param service
 * @returns Promise resolving to check result
 */
declare function check(service: string): Promise<{
    ok: boolean;
    reason?: string;
}>;
/**
 * Record actual cost incurred (called after successful STT).
 * @param service
 * @param usd
 */
declare function recordCost(service: string, usd: number): void;
declare const _default: {
    check: typeof check;
    recordCost: typeof recordCost;
};
export = _default;
//# sourceMappingURL=limiter.d.ts.map