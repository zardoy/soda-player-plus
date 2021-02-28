import asar from "asar";
import child_process from "child_process";
import fsOrig from "fs";
import fse from "fs-extra";
import path from "path";
import rimraf from "rimraf";
import semver from "semver";

const fs = fsOrig.promises;

export const getPaths = async (electronAppBase: string) => {
    const filelist = await fs.readdir(electronAppBase);
    const appDirs = filelist
        .filter(file => file.startsWith("app-"))
        .map(file => file.slice("app-".length));

    const biggestVersion = semver.sort(appDirs).reverse()[0];
    const appResourcesDir = path.join(electronAppBase, `app-${biggestVersion}/resources`);

    return {
        appResourcesDir,
        asarSource: path.join(appResourcesDir, "app.asar"),
        oldAsarSource: path.join(appResourcesDir, "app.asar.old"),
        asarUnpacked: path.join(appResourcesDir, "app")
    };
};

export const isPatc hAvailable = async (localAppdataDir: string) => {
    const { appResourcesDir } = await getPaths(
        path.join(process.env.LOCALAPPDATA || "", localAppdataDir)
    );
    if (!fse.existsSync(appResourcesDir)) {
        return false;
    }
    if (fse.existsSync(path.join(appResourcesDir, "PATCHED"))) {
        return false;
    } else {
        return true;
    }
};

type PatchConfig = Array<{
    filePath: string;
    replace: Array<[
        RegExp,
        string | ((substring: string, ...args: any[]) => string)
    ]>;
}>;

interface AppConfig {
    // sodaplayer
    localAppdataDir: string;
    // Soda Player
    appName: string;
    patchContents: (config: { contentsDir: string; }) => Promise<void>;
}

const dev = async (appConfig: AppConfig) => {
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

    const needLogs = process.env.NEED_LOGS === "1",
        // specify args for testing. use , as a delimiter
        startArgs = (process.env.START_ARGS || "").split(",");
    if (!needLogs) {
        // real world test
        child_process.spawn(path.join(sodaPlayerBase, `Soda Player.exe`), startArgs, {
            detached: true,
            stdio: "ignore"
        });
    } else {
        child_process.execFileSync(
            path.join(asarBaseDir, "../Soda Player.exe"), startArgs, { stdio: "inherit" }
        );
    }
};

export const patchElectronApp = async ({ localAppdataDir, appName, patchContents }: AppConfig) => {
    if (process.platform !== "win32") throw new Error(`Only windows platform is supported`);
    if (!process.env.LOCALAPPDATA) throw new Error(`%LOCALAPPDATA% doesn't exist. Check the environment`);
    const electronAppBase = path.join(process.env.LOCALAPPDATA, localAppdataDir);
    if (!fse.existsSync(electronAppBase)) throw new Error(`%LOCALAPPDATA%/${localAppdataDir} doesn't exist. You must install ${appName} first!`);

    const { appResourcesDir, asarSource, asarUnpacked, oldAsarSource } = await getPaths();

    if (fse.existsSync(oldAsarSource)) {
        await fs.rename(oldAsarSource, asarSource);
    }
    if (fse.existsSync(asarUnpacked)) {
        rimraf.sync(asarUnpacked);
    }

    asar.extractAll(
        asarSource,
        asarUnpacked
    );
    await new Promise(resolve => setTimeout(resolve, 500));
    const returnValueOfPatchFn = await patchContents({ contentsDir: asarUnpacked });

    // we're not creating app.asar since electron should pick contents of app/ dir
    await fs.rename(
        asarSource,
        oldAsarSource
    );

    await new Promise(resolve => setTimeout(resolve, 1500));
    fs.writeFile(path.join(appResourcesDir, "PATCHED"), "", "utf-8");
};