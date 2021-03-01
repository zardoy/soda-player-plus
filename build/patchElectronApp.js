"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchElectronApp = exports.isPatchAvailable = exports.getPaths = void 0;
const asar_1 = __importDefault(require("asar"));
const fs_1 = __importDefault(require("fs"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const rimraf_1 = __importDefault(require("rimraf"));
const semver_1 = __importDefault(require("semver"));
const fs = fs_1.default.promises;
const getPaths = async (localAppdataDir) => {
    const electronAppBase = path_1.default.join(process.env.LOCALAPPDATA || "", localAppdataDir);
    if (!fs_extra_1.default.existsSync(electronAppBase))
        throwErrNoAppInAppdata();
    const filelist = await fs.readdir(electronAppBase);
    const appDirs = filelist
        .filter(file => file.startsWith("app-"))
        .map(file => file.slice("app-".length));
    const biggestVersion = semver_1.default.sort(appDirs).reverse()[0];
    const appResourcesDir = path_1.default.join(electronAppBase, `app-${biggestVersion}/resources`);
    return {
        appBase: electronAppBase,
        appResourcesDir,
        asarSource: path_1.default.join(appResourcesDir, "app.asar"),
        oldAsarSource: path_1.default.join(appResourcesDir, "app.asar.old"),
        asarUnpacked: path_1.default.join(appResourcesDir, "app")
    };
};
exports.getPaths = getPaths;
const isPatchAvailable = async ({ localAppdataDir }) => {
    try {
        const { appResourcesDir } = await exports.getPaths(localAppdataDir);
        if (fs_extra_1.default.existsSync(path_1.default.join(appResourcesDir, "PATCHED"))) {
            return false;
        }
        else {
            return true;
        }
    }
    catch {
        return false;
    }
};
exports.isPatchAvailable = isPatchAvailable;
const throwErrNoAppInAppdata = () => {
    throw new Error(`%LOCALAPPDATA% doesn't exist. Check the environment`);
};
const patchElectronApp = async ({ localAppdataDir, appName, patchContents }) => {
    if (process.platform !== "win32")
        throw new Error(`Only windows platform is supported`);
    if (!process.env.LOCALAPPDATA)
        throwErrNoAppInAppdata();
    const electronAppBase = path_1.default.join(process.env.LOCALAPPDATA, localAppdataDir);
    if (!fs_extra_1.default.existsSync(electronAppBase))
        throw new Error(`%LOCALAPPDATA%/${localAppdataDir} doesn't exist. You must install ${appName} first!`);
    const { appResourcesDir, asarSource, asarUnpacked, oldAsarSource } = await exports.getPaths(localAppdataDir);
    if (fs_extra_1.default.existsSync(oldAsarSource)) {
        await fs.rename(oldAsarSource, asarSource);
    }
    if (fs_extra_1.default.existsSync(asarUnpacked)) {
        rimraf_1.default.sync(asarUnpacked);
    }
    asar_1.default.extractAll(asarSource, asarUnpacked);
    await new Promise(resolve => setTimeout(resolve, 500));
    await patchContents({ contentsDir: asarUnpacked });
    // we're not creating app.asar since electron should pick contents of app/ dir
    await fs.rename(asarSource, oldAsarSource);
    await new Promise(resolve => setTimeout(resolve, 1500));
    await fs.writeFile(path_1.default.join(appResourcesDir, "PATCHED"), "", "utf-8");
};
exports.patchElectronApp = patchElectronApp;
