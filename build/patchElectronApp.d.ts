export declare const getPaths: (localAppdataDir: string) => Promise<{
    appBase: string;
    appResourcesDir: string;
    asarSource: string;
    oldAsarSource: string;
    asarUnpacked: string;
}>;
export declare const isPatchAvailable: ({ localAppdataDir }: Pick<AppConfig, "localAppdataDir">) => Promise<boolean>;
export interface AppConfig {
    localAppdataDir: string;
    appName: string;
    patchContents: (config: {
        contentsDir: string;
    }) => Promise<void>;
}
export declare const patchElectronApp: ({ localAppdataDir, appName, patchContents }: AppConfig) => Promise<void>;
