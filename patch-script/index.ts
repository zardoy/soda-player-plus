import AdmZip from "adm-zip";
import download from "download";
import fsOrig from "fs";
import fse from "fs-extra";
import os from "os";
import path from "path";
import rimraf from "rimraf";

import { patchElectronApp } from "./patchElectronApp";

const fs = fsOrig.promises;

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

const index = async (customPatchDirectory?: string) => {
    const tmpDirForDownloadingPatch = os.tmpdir();
    await patchElectronApp({
        appName: "Soda Player",
        localAppdataDirName: "sodaplayer",
        async patchContents({ contentsDir }) {
            let patchDir: string;
            if (customPatchDirectory) {
                patchDir = customPatchDirectory;
            } else {
                const downloadPatchUrl = "https://github.com/zardoy/soda-player-plus/archive/main.zip";

                await download(downloadPatchUrl, tmpDirForDownloadingPatch, {
                    filename: "patch-archive"
                });
                const patchArchive = path.join(tmpDirForDownloadingPatch, "patch-archive");
                const adm = new AdmZip(patchArchive);
                await new Promise(resolve => adm.extractAllToAsync("patch", true, resolve));
                rimraf.sync(patchArchive);
                patchDir = path.resolve(tmpDirForDownloadingPatch, "patch/soda-player-plus-main/patch");
            }

            await fse.copy(
                patchDir,
                contentsDir,
                {
                    overwrite: true,
                }
            );
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
        rimraf.sync(
            path.join(tmpDirForDownloadingPatch, "patch")
        );
    }
};