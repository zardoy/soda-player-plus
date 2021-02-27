import AdmZip from "adm-zip";
import asar from "asar";
import child_process from "child_process";
import download from "download";
import fsOrig from "fs";
import fse from "fs-extra";
import md5File from "md5-file";
import path from "path";
import rimraf from "rimraf";
import semver from "semver";

const fs = fsOrig.promises;

const sodaPlayerBase = path.normalize(`${process.env.LOCALAPPDATA}/sodaplayer/`);

export const getPaths = async () => {
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
    if (!fse.existsSync(asarSource)) {
        return false;
    }
    const expectedMd5 = "7A751DCD8C97B9974A4CC9B5BCBB2CCD".toLowerCase();
    return (await md5File(asarSource)) !== expectedMd5;
};

type PatchConfig = Array<{
    filePath: string;
    replace: Array<[
        RegExp,
        string | ((substring: string, ...args: any[]) => string)
    ]>;
}>;

const filePathRegexps = async (basePath: string, patchConfig: PatchConfig) => {
    for (const { filePath: relativeFilePath, replace } of patchConfig) {
        const filePath = path.join(basePath, relativeFilePath);
        let contents = await fs.readFile(filePath, "utf-8");
        for (const [regex, replacement] of replace) {
            //@ts-ignore report bug?
            contents = contents.replace(regex, replacement);
        }
        await fs.writeFile(filePath, contents);
    }
};

const patchFiles = async (filesBase: string) => {
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

export const patchSodaPlayer = async () => {
    if (!fse.existsSync(sodaPlayerBase)) {
        throw new Error("You must install SodaPlayer first!");
    }

    const isDev = process.env.DEV_MODE;

    let patchDir: string;
    const tmpDirForDownloadingPatch = __dirname;
    if (isDev) {
        (await import("dotenv")).config({
            path: path.join(__dirname, ".env")
        });
        const psList = (await import("ps-list")).default;
        const { killer } = await import("cross-port-killer");
        const pid = (await psList())
            .find(({ name }) => /soda/i.test(name));
        if (pid) {
            await killer.killByPid(pid.pid.toString());
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        patchDir = path.join(__dirname, "../patch");
    } else {
        const url = "https://github.com/zardoy/soda-player-plus/archive/main.zip";

        await download(url, tmpDirForDownloadingPatch, {
            filename: "patch-archive"
        });
        const adm = new AdmZip(
            path.join(tmpDirForDownloadingPatch, "patch-archive")
        );
        await new Promise(resolve => adm.extractAllToAsync("patch", true, resolve));
        rimraf.sync(
            path.join(tmpDirForDownloadingPatch, "patch-archive")
        );
        patchDir = path.resolve(tmpDirForDownloadingPatch, "patch/soda-player-plus-main/patch");
    }

    const { asarSource, asarUnpacked, oldAsarSource } = await getPaths();

    if (isDev) {
        // in dev, we're keeping asar.old as original
        if (fse.existsSync(oldAsarSource)) {
            await fs.unlink(asarSource);
            await fs.copyFile(oldAsarSource, asarSource);
        } else {
            await fs.copyFile(asarSource, oldAsarSource);
        }
    }

    asar.extractAll(
        asarSource,
        asarUnpacked
    );
    await new Promise(resolve => setTimeout(resolve, 500));
    await fse.copy(
        patchDir,
        asarUnpacked,
        {
            overwrite: true,
        }
    );
    await patchFiles(asarUnpacked);

    // removing app.asar before creating new one
    if (isDev) {
        await fs.unlink(asarSource);
    } else {
        if (fse.existsSync(oldAsarSource)) {
            await fs.unlink(oldAsarSource);
        }
        await fs.rename(
            asarSource,
            oldAsarSource
        );
    }
    // creating patched app.asar
    await asar.createPackage(
        asarUnpacked,
        asarSource
    );

    await new Promise(resolve => setTimeout(resolve, 1500));
    // cleanup
    if (isDev) {
        console.log(process.env.START_ARGS);
        child_process.spawn(`C:/Users/Professional/AppData/Local/sodaplayer/Soda Player.exe ${process.env.START_ARGS || ""}`, [], {
            detached: true,
            stdio: "ignore"
        });
    } else {
        rimraf.sync(
            asarUnpacked
        );
        rimraf.sync(
            path.join(tmpDirForDownloadingPatch, "patch")
        );
    }
};

(async () => {
    if (require.main === module) {
        await patchSodaPlayer();
    }
})();