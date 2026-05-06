"use strict";

const { createCallerValidator } = require("@kanelr/security-utils/caller-validator");

const validator = createCallerValidator({ extraFields: ["userId"] });

export = { resolveCaller: validator.resolveCaller };