"use strict";
const { createCallerValidator } = require("@acegalaxy/lib-security-utils/caller-validator");
const validator = createCallerValidator({ extraFields: ["userId"] });
module.exports = { resolveCaller: validator.resolveCaller };
//# sourceMappingURL=resolver.js.map