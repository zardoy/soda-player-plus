"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchSodaPlayer = exports.sodaPlayerBasicConfig = void 0;
const adm_zip_1 = __importDefault(require("adm-zip"));
const download_1 = __importDefault(require("download"));
const fs_1 = __importDefault(require("fs"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const rimraf_1 = __importDefault(require("rimraf"));
const patchElectronApp_1 = require("./patchElectronApp");
const fs = fs_1.default.promises;
const filePathRegexps = async (basePath, patchConfig) => {
    for (const { filePath: relativeFilePath, replace } of patchConfig) {
        const filePath = path_1.default.join(basePath, relativeFilePath);
        let contents = await fs.readFile(filePath, "utf-8");
        for (const [regex, replacement] of replace) {
            //@ts-ignore report bug?
            contents = contents.replace(regex, replacement);
        }
        await fs.writeFile(filePath, contents);
    }
};
exports.sodaPlayerBasicConfig = {
    appName: "Soda Player",
    localAppdataDir: "sodaplayer",
};
const patchSodaPlayer = async (customPatchDirectory) => {
    const tmpDirForDownloadingPatch = os_1.default.tmpdir();
    await patchElectronApp_1.patchElectronApp({
        ...exports.sodaPlayerBasicConfig,
        async patchContents({ contentsDir }) {
            let patchDir;
            if (customPatchDirectory) {
                patchDir = customPatchDirectory;
            }
            else {
                const downloadPatchUrl = "https://github.com/zardoy/soda-player-plus/archive/main.zip";
                await download_1.default(downloadPatchUrl, tmpDirForDownloadingPatch, {
                    filename: "patch-archive"
                });
                const patchArchive = path_1.default.join(tmpDirForDownloadingPatch, "patch-archive");
                const adm = new adm_zip_1.default(patchArchive);
                await new Promise(resolve => adm.extractAllToAsync("patch", true, resolve));
                rimraf_1.default.sync(patchArchive);
                patchDir = path_1.default.resolve(tmpDirForDownloadingPatch, "patch/soda-player-plus-main/patch");
            }
            await fs_extra_1.default.copy(patchDir, contentsDir, {
                overwrite: true,
            });
            filePathRegexps(contentsDir, [
                {
                    filePath: "index.html",
                    replace: [
                        [/<!-- Google Analytics -->.+?<!-- End Google Analytics -->/is, ""],
                        [/<script src="vendor\/jquery\/dist\/jquery\.slim\.min\.js"/is,
                            `<!-- PLUS SCRIPTS -->\n<script src="plus/renderer.js"></script>\n\n$&`]
                    ]
                },
                {
                    filePath: "package.json",
                    replace: [
                        [/js\/main\/main.js/i, "plus/main.js"]
                    ]
                }
            ]);
        }
    });
    if (!customPatchDirectory) {
        rimraf_1.default.sync(path_1.default.join(tmpDirForDownloadingPatch, "patch"));
    }
};
exports.patchSodaPlayer = patchSodaPlayer;
