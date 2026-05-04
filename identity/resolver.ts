"use strict";

const { createCallerValidator } = require("../../security-utils-nodejs/caller-validator");

const validator = createCallerValidator({ extraFields: ["userId"] });

export = { resolveCaller: validator.resolveCaller };