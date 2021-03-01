import child_process from "child_process";
import { killer } from "cross-port-killer";
import dotenv from "dotenv";
import path from "path";
import psList from "ps-list";

import { patchSodaPlayer, sodaPlayerBasicConfig } from "./";
import { getPaths } from "./patchElectronApp";

dotenv.config({
    path: path.join(__dirname, ".env")
});

const killApp = async ({ appName }: { appName: string; }) => {
    const appProcess = (await psList())
        .find(({ name: processName }) => processName.includes(appName));
    if (appProcess) {
        await killer.killByPid(appProcess.pid.toString());
        await new Promise(resolve => setTimeout(resolve, 500));
    }
};

const launchApp = async ({ localAppdataDir, appName }: typeof sodaPlayerBasicConfig) => {
    const needLogs = process.env.NEED_LOGS === "1",
        // specify args for testing. use , as a delimiter
        startArgs = (process.env.START_ARGS || "").split(",");
    const appExec = `${appName}.exe`;
    const { appResourcesDir, appBase } = await getPaths(localAppdataDir);
    if (!needLogs) {
        // real world test
        child_process.spawn(path.join(appBase, appExec), startArgs, {
            detached: true,
            stdio: "ignore"
        });
    } else {
        child_process.execFileSync(
            path.join(appResourcesDir, "..", appExec), startArgs, { stdio: "inherit" }
        );
    }
};

(async () => {
    const { appName, localAppdataDir } = sodaPlayerBasicConfig;
    await killApp({ appName });
    const patchDir = path.join(__dirname, "../patch");
    await patchSodaPlayer(patchDir);
    await launchApp({
        appName,
        localAppdataDir
    });
})();