"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = require("fs-extra");
const open_1 = __importDefault(require("open"));
const index_1 = require("./index");
(async () => {
    const { asarUnpacked } = await index_1.getPaths();
    if (fs_extra_1.existsSync(asarUnpacked)) {
        await open_1.default(asarUnpacked);
    }
    else {
        throw new Error("Directory doesn't exists. Run start script first");
    }
})();
