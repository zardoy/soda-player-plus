import { existsSync } from "fs-extra";
import open from "open";

import { getPaths } from "./patchElectronApp";

(async () => {
    const { asarUnpacked } = await getPaths();
    if (existsSync(asarUnpacked)) {
        await open(asarUnpacked);
    } else {
        throw new Error("Directory doesn't exists. Run start script first");
    }
})();