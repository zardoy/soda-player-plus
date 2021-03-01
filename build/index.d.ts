import { AppConfig } from "./patchElectronApp";
export declare const sodaPlayerBasicConfig: Omit<AppConfig, "patchContents">;
export declare const patchSodaPlayer: (customPatchDirectory?: string | undefined) => Promise<void>;
