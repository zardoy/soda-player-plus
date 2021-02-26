"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchSodaPlayer = exports.isPatchAvailable = void 0;
const adm_zip_1 = __importDefault(require("adm-zip"));
const asar_1 = __importDefault(require("asar"));
const download_1 = __importDefault(require("download"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const promises_1 = __importDefault(require("fs/promises"));
const md5_file_1 = __importDefault(require("md5-file"));
const path_1 = __importDefault(require("path"));
const rimraf_1 = __importDefault(require("rimraf"));
const semver_1 = __importDefault(require("semver"));
const sodaPlayerBase = path_1.default.normalize(`${process.env.LOCALAPPDATA}/sodaplayer/`);
const getPaths = async () => {
    const filelist = await promises_1.default.readdir(sodaPlayerBase);
    const appDirs = filelist
        .filter(file => file.startsWith("app-"))
        .map(file => file.slice("app-".length));
    const biggestVersion = semver_1.default.sort(appDirs).reverse()[0];
    const asarBaseDir = path_1.default.join(sodaPlayerBase, `app-${biggestVersion}/resources`);
    return {
        asarBaseDir,
        asarSource: path_1.default.join(asarBaseDir, "app.asar"),
        oldAsarSource: path_1.default.join(asarBaseDir, "app.asar.old"),
        asarUnpacked: path_1.default.join(asarBaseDir, "app")
    };
};
const isPatchAvailable = async () => {
    const { asarSource } = await getPaths();
    const expectedMd5 = "7A751DCD8C97B9974A4CC9B5BCBB2CCD".toLowerCase();
    return (await md5_file_1.default(asarSource)) !== expectedMd5;
};
exports.isPatchAvailable = isPatchAvailable;
const patchSodaPlayer = async () => {
    const url = "https://github.com/zardoy/soda-player-plus/archive/main.zip";
    const tmpDir = __dirname;
    await download_1.default(url, tmpDir, {
        filename: "patch-archive"
    });
    const adm = new adm_zip_1.default(path_1.default.join(tmpDir, "patch-archive"));
    await new Promise(resolve => adm.extractAllToAsync("patch", true, resolve));
    rimraf_1.default.sync(path_1.default.join(tmpDir, "patch-archive"));
    const patchDir = path_1.default.resolve(tmpDir, "patch/soda-player-plus-main/patch");
    const { asarSource, asarUnpacked, oldAsarSource } = await getPaths();
    asar_1.default.extractAll(asarSource, asarUnpacked);
    await new Promise(resolve => setTimeout(resolve, 500));
    if (fs_extra_1.default.existsSync(oldAsarSource)) {
        await promises_1.default.unlink(oldAsarSource);
    }
    await fs_extra_1.default.copy(patchDir, asarUnpacked, {
        overwrite: true,
    });
    await promises_1.default.rename(asarSource, oldAsarSource);
    await asar_1.default.createPackage(asarUnpacked, asarSource);
    await new Promise(resolve => setTimeout(resolve, 1500));
    // cleanup. remove dirs
    rimraf_1.default.sync(asarUnpacked);
    rimraf_1.default.sync(path_1.default.join(tmpDir, "patch"));
};
exports.patchSodaPlayer = patchSodaPlayer;
(async () => {
    console.log(await exports.isPatchAvailable());
})();
