"use strict";

const { createCallerValidator } = require("@acegalaxy-co/security-utils/caller-validator");

const validator = createCallerValidator({ extraFields: ["userId"] });

export = { resolveCaller: validator.resolveCaller };