import AdmZip from "adm-zip";
import asar from "asar";
import download from "download";
import fse from "fs-extra";
import fs from "fs/promises";
import md5File from "md5-file";
import path from "path";
import rimraf from "rimraf";
import semver from "semver";

const sodaPlayerBase = path.normalize(`${process.env.LOCALAPPDATA}/sodaplayer/`);

const getPaths = async () => {
    const filelist = await fs.readdir(sodaPlayerBase);
    const appDirs = filelist
        .filter(file => file.startsWith("app-"))
        .map(file => file.slice("app-".length));

    const biggestVersion = semver.sort(appDirs).reverse()[0];
    const asarBaseDir = path.join(sodaPlayerBase, `app-${biggestVersion}/resources`);
    return {
        asarBaseDir,
        asarSource: path.join(asarBaseDir, "app.asar"),
        oldAsarSource: path.join(asarBaseDir, "app.asar.old"),
        asarUnpacked: path.join(asarBaseDir, "app")
    };
};

export const isPatchAvailable = async () => {
    const { asarSource } = await getPaths();
    const expectedMd5 = "7A751DCD8C97B9974A4CC9B5BCBB2CCD".toLowerCase();
    return (await md5File(asarSource)) !== expectedMd5;
};

export const patchSodaPlayer = async () => {
    const url = "https://github.com/zardoy/soda-player-plus/archive/main.zip";

    const tmpDir = __dirname;
    await download(url, tmpDir, {
        filename: "patch-archive"
    });
    const adm = new AdmZip(
        path.join(tmpDir, "patch-archive")
    );
    await new Promise(resolve => adm.extractAllToAsync("patch", true, resolve));
    rimraf.sync(
        path.join(tmpDir, "patch-archive")
    );
    const patchDir = path.resolve(tmpDir, "patch/soda-player-plus-main/patch");

    const { asarSource, asarUnpacked, oldAsarSource } = await getPaths();

    asar.extractAll(
        asarSource,
        asarUnpacked
    );
    await new Promise(resolve => setTimeout(resolve, 500));
    if (fse.existsSync(oldAsarSource)) {
        await fs.unlink(oldAsarSource);
    }

    await fse.copy(
        patchDir,
        asarUnpacked,
        {
            overwrite: true,
        }
    );
    await fs.rename(
        asarSource,
        oldAsarSource
    );
    await asar.createPackage(
        asarUnpacked,
        asarSource
    );

    await new Promise(resolve => setTimeout(resolve, 1500));
    // cleanup. remove dirs
    rimraf.sync(
        asarUnpacked
    );
    rimraf.sync(
        path.join(tmpDir, "patch")
    );
};

(async () => {
    console.log(await isPatchAvailable());
})();