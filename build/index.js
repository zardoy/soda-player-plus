"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchSodaPlayer = exports.isPatchAvailable = exports.getPaths = void 0;
const adm_zip_1 = __importDefault(require("adm-zip"));
const asar_1 = __importDefault(require("asar"));
const child_process_1 = __importDefault(require("child_process"));
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
exports.getPaths = getPaths;
const isPatchAvailable = async () => {
    const { asarSource } = await exports.getPaths();
    const expectedMd5 = "7A751DCD8C97B9974A4CC9B5BCBB2CCD".toLowerCase();
    return (await md5_file_1.default(asarSource)) !== expectedMd5;
};
exports.isPatchAvailable = isPatchAvailable;
const filePathRegexps = async (basePath, patchConfig) => {
    for (const { filePath: relativeFilePath, replace } of patchConfig) {
        const filePath = path_1.default.join(basePath, relativeFilePath);
        let contents = await promises_1.default.readFile(filePath, "utf-8");
        for (const [regex, replacement] of replace) {
            //@ts-ignore report bug?
            contents = contents.replace(regex, replacement);
        }
        await promises_1.default.writeFile(filePath, contents);
    }
};
const patchFiles = async (filesBase) => {
    // patch index.html
    // i don't use cheerio since its really bad. regex is much reliable
    filePathRegexps(filesBase, [
        {
            filePath: "index.html",
            replace: [
                [/<!-- Google Analytics -->.+?<!-- End Google Analytics -->/is, ""],
                [/<script src="vendor\/jquery\/dist\/jquery\.slim\.min\.js"/is,
                    `<!-- PLUS SCRIPTS -->\n<script src="plus/index.js"></script>\n\n$&`]
            ]
        }
    ]);
};
const patchSodaPlayer = async () => {
    if (!fs_extra_1.default.existsSync(sodaPlayerBase)) {
        throw new Error("You must install SodaPlayer first!");
    }
    const isDev = process.env.DEV_MODE;
    let patchDir;
    const tmpDirForDownloadingPatch = __dirname;
    if (isDev) {
        (await Promise.resolve().then(() => __importStar(require("dotenv")))).config({
            path: path_1.default.join(__dirname, ".env")
        });
        const psList = (await Promise.resolve().then(() => __importStar(require("ps-list")))).default;
        const { killer } = await Promise.resolve().then(() => __importStar(require("cross-port-killer")));
        const pid = (await psList())
            .find(({ name }) => /soda/i.test(name));
        if (pid) {
            await killer.killByPid(pid.pid.toString());
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        patchDir = path_1.default.join(__dirname, "../patch");
    }
    else {
        const url = "https://github.com/zardoy/soda-player-plus/archive/main.zip";
        await download_1.default(url, tmpDirForDownloadingPatch, {
            filename: "patch-archive"
        });
        const adm = new adm_zip_1.default(path_1.default.join(tmpDirForDownloadingPatch, "patch-archive"));
        await new Promise(resolve => adm.extractAllToAsync("patch", true, resolve));
        rimraf_1.default.sync(path_1.default.join(tmpDirForDownloadingPatch, "patch-archive"));
        patchDir = path_1.default.resolve(tmpDirForDownloadingPatch, "patch/soda-player-plus-main/patch");
    }
    const { asarSource, asarUnpacked, oldAsarSource } = await exports.getPaths();
    if (isDev) {
        // in dev, we're keeping asar.old as original
        if (fs_extra_1.default.existsSync(oldAsarSource)) {
            await promises_1.default.unlink(asarSource);
            await promises_1.default.copyFile(oldAsarSource, asarSource);
        }
        else {
            await promises_1.default.copyFile(asarSource, oldAsarSource);
        }
    }
    asar_1.default.extractAll(asarSource, asarUnpacked);
    await new Promise(resolve => setTimeout(resolve, 500));
    await fs_extra_1.default.copy(patchDir, asarUnpacked, {
        overwrite: true,
    });
    await patchFiles(asarUnpacked);
    // removing app.asar before creating new one
    if (isDev) {
        await promises_1.default.unlink(asarSource);
    }
    else {
        if (fs_extra_1.default.existsSync(oldAsarSource)) {
            await promises_1.default.unlink(oldAsarSource);
        }
        await promises_1.default.rename(asarSource, oldAsarSource);
    }
    // creating patched app.asar
    await asar_1.default.createPackage(asarUnpacked, asarSource);
    await new Promise(resolve => setTimeout(resolve, 1500));
    // cleanup
    if (isDev) {
        console.log(process.env.START_ARGS);
        child_process_1.default.spawn(`C:/Users/Professional/AppData/Local/sodaplayer/Soda Player.exe ${process.env.START_ARGS || ""}`, [], {
            detached: true,
            stdio: "ignore"
        });
    }
    else {
        rimraf_1.default.sync(asarUnpacked);
        rimraf_1.default.sync(path_1.default.join(tmpDirForDownloadingPatch, "patch"));
    }
};
exports.patchSodaPlayer = patchSodaPlayer;
(async () => {
    if (require.main === module) {
        await exports.patchSodaPlayer();
    }
})();
