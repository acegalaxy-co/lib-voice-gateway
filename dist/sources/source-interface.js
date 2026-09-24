"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IVoiceSource = void 0;
class IVoiceSource {
    /** @returns {"telegram"|"whatsapp"|"wechat"|"http"|"file"} */
    get source() {
        throw new Error("abstract: source");
    }
    /**
     * Fetch audio bytes from the source.
     * @param sourceData opaque per-source descriptor
     * @param opts
     */
    async fetch(_sourceData, _opts) {
        throw new Error("abstract: fetch");
    }
}
exports.IVoiceSource = IVoiceSource;
//# sourceMappingURL=source-interface.js.map