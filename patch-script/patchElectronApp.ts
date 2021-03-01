import asar from "asar";
import fsOrig from "fs";
import fse from "fs-extra";
import path from "path";
import rimraf from "rimraf";
import semver from "semver";

const fs = fsOrig.promises;

export const getPaths = async (localAppdataDir: string) => {
    const electronAppBase = path.join(process.env.LOCALAPPDATA || "", localAppdataDir);
    if (!fse.existsSync(electronAppBase)) throwErrNoAppInAppdata();
    const filelist = await fs.readdir(electronAppBase);
    const appDirs = filelist
        .filter(file => file.startsWith("app-"))
        .map(file => file.slice("app-".length));

    const biggestVersion = semver.sort(appDirs).reverse()[0];
    const appResourcesDir = path.join(electronAppBase, `app-${biggestVersion}/resources`);

    return {
        appBase: electronAppBase,
        appResourcesDir,
        asarSource: path.join(appResourcesDir, "app.asar"),
        oldAsarSource: path.join(appResourcesDir, "app.asar.old"),
        asarUnpacked: path.join(appResourcesDir, "app")
    };
};

export const isPatchAvailable = async ({ localAppdataDir }: Pick<AppConfig, "localAppdataDir">) => {
    try {
        const { appResourcesDir } = await getPaths(localAppdataDir);
        if (fse.existsSync(path.join(appResourcesDir, "PATCHED"))) {
            return false;
        } else {
            return true;
        }
    } catch {
        return false;
    }
};

export interface AppConfig {
    // sodaplayer
    localAppdataDir: string;
    // Soda Player
    appName: string;
    patchContents: (config: { contentsDir: string; }) => Promise<void>;
}

const throwErrNoAppInAppdata = () => {
    throw new Error(`%LOCALAPPDATA% doesn't exist. Check the environment`);
};

export const patchElectronApp = async ({ localAppdataDir, appName, patchContents }: AppConfig) => {
    if (process.platform !== "win32") throw new Error(`Only windows platform is supported`);
    if (!process.env.LOCALAPPDATA) throwErrNoAppInAppdata();
    const electronAppBase = path.join(process.env.LOCALAPPDATA!, localAppdataDir);
    if (!fse.existsSync(electronAppBase)) throw new Error(`%LOCALAPPDATA%/${localAppdataDir} doesn't exist. You must install ${appName} first!`);

    const { appResourcesDir, asarSource, asarUnpacked, oldAsarSource } = await getPaths(localAppdataDir);

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
    await patchContents({ contentsDir: asarUnpacked });

    // we're not creating app.asar since electron should pick contents of app/ dir
    await fs.rename(asarSource, oldAsarSource);

    await new Promise(resolve => setTimeout(resolve, 1500));
    await fs.writeFile(path.join(appResourcesDir, "PATCHED"), "", "utf-8");
};