export declare const getPaths: () => Promise<{
    asarBaseDir: string;
    asarSource: string;
    oldAsarSource: string;
    asarUnpacked: string;
}>;
export declare const isPatchAvailable: () => Promise<boolean>;
export declare const patchSodaPlayer: () => Promise<void>;
