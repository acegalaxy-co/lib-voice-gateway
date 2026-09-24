"use strict";
class IVoiceAdapter {
    /** @returns {"whisper"|"gemini"|"local"} */
    get provider() {
        throw new Error("abstract: provider");
    }
}
module.exports = { IVoiceAdapter };
//# sourceMappingURL=adapter-interface.js.map