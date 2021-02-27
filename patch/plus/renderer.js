//@ts-check
"use strict";

(async () => {
    // try to avoid error logs. doesn't really matter
    // @ts-ignore
    window.ga = () => { }; ga.l = +new Date;

    const consoleLogOld = console.log.bind(console);
    let initResolve = () => { };
    console.log = (...args) => {
        // parse logs here

        const firstArg = args[0];
        if (typeof firstArg === "string" && firstArg.includes("video size")) {
            initResolve();
        }

        consoleLogOld(...args)
    }


    console.log("%c[PATCHED] SODA PLAYER PLUS", "color: deepskyblue;font-weight: 900;font-size:1.2em;");
    console.log("To enable/disable feature use enableFeature/disableFeature . After feature was disabled you need to press CTRL+R while focus in DevTools to take effect. Happy hacking!");
    // @ts-ignore
    await new Promise(resolve => initResolve = resolve);
    // @ts-ignore
    const mainWindow = electron.remote.BrowserWindow.getAllWindows()[1];
    //FEATURE: indicate its a plus version (patched)
    // window title NOT IMPLEMENTED YET
    //FEATURE END
    // FEATURE time on center
    const controlsChrome = document.querySelector(".controls.chrome");
    // @ts-ignore
    if (controlsChrome && !document.querySelector("#system_time_display")) {
        controlsChrome.insertAdjacentHTML("afterbegin", `<div style="
    position: fixed;
    z-index: -5;
    top: 0;
    left: 0;
    width: 100%;
    overflow: hidden;
    display: flex;
    justify-content: center;
"><small id="system_time_display" style="
    color: white;
    margin-top: 5px;
"></small>
    </div>`);
        let formatter = new Intl.DateTimeFormat(undefined, {//using system locale
            hour: "2-digit",
            minute: "2-digit"
        });
        setInterval(() => {
            // @ts-ignore
            document.querySelector("#system_time_display").innerText = formatter.format(new Date());
        }, 1000);
    }
    // FEATURE END
    const winButtons = document.querySelector(".window-controls-win > .buttons");
    // FEATURE: don't hide window control buttons in fullscreen
    const observer = new MutationObserver(() => {
        observer.disconnect();
        winButtons.classList.remove("hidden");
        observer.observe(winButtons, { attributeFilter: ["class"] });
    });

    observer.observe(winButtons, { attributeFilter: ["class"] });
    // FEATURE END

    const setPlayState = action => {
        const togglePlay = () => {
            // @ts-ignore
            document.querySelector("#player .play-pause-button > :not(.hidden)").click();
        };
        const playButton = document.querySelector(".play-pause-button > .play");
        if (action === "play" && !playButton.classList.contains("hidden")) {
            togglePlay();
        }
        if (action === "pause" && playButton.classList.contains("hidden")) {
            togglePlay();
        }
    }

    // OPTIONAL FEATURES
    const optionalFeatures = {
        mediaKeys() {//no hardware support! So it wont dispay overlay.
            // @ts-ignore
            electron.remote.globalShortcut.register("MediaPlayPause", () => setPlayState("toggle"));
        },
        progressBar() {
            if (!mainWindow || process.platform !== "win32") return;
            // const progress = document.querySelector("#player input.slider").style.backgroundImage;
            // const isOnPause = 
            let isPlaying = true,
                progress = 0;
            const updateProgress = () => {
                mainWindow.setProgressBar(progress || 0, {
                    mode: isPlaying ? "normal" : "paused"
                });
            }
            const slider = document.querySelector("#player input.slider");
            const playButton = document.querySelector(".play-pause-button > .play");
            new MutationObserver(() => {
                progress = parseFloat(
                    // @ts-ignore
                    ((slider.style.backgroundImage || "").match(/color-stop\((\d\.\d+)/) || [, 0])[1]
                );
                updateProgress();
            })
                .observe(slider, {
                    attributeFilter: ["style"]
                });
            new MutationObserver(() => {
                isPlaying = playButton.classList.contains("hidden");
                updateProgress();
            })
                .observe(playButton, {
                    attributeFilter: ["class"]
                })
        },
        winControlsOpacity() {
            if (winButtons) {
                // @ts-ignore
                winButtons.style.backgroundColor = "rgba(0, 0, 0, 0.2)";
            }
        },
        // implement: savePosition
        thumbarButtons() {
            // it doesn't work for some reason. and I don't care anymore I'll just write my version
            // I don't wanna lose my time any more with this old electron version
            if (true || !mainWindow || process.platform !== "win32") return;
            const toggleFullscreen = () => {
                console.log("fullscreen")
            };
            const updateButtons = (isPlaying) => {
                const buttons = [
                    ["prev", () => console.log("prev")],
                    [isPlaying ? "pause" : "play", () => setPlayState("toggle")],
                    ["next", () => console.log("next")],
                    ["fullscreen", toggleFullscreen],
                ];
                mainWindow.setThumbarButtons(
                    buttons.map(([icon, callback, disabled = false]) => {
                        return {
                            // @ts-ignore
                            icon: electron.nativeImage.createFromPath(
                                `${__dirname}/plus/thumbar_control/${icon}.png`
                            ),
                            click: callback
                        }
                    })
                )
            }
            updateButtons(false);
            const playButton = document.querySelector(".play-pause-button > .play");
            new MutationObserver(() => {
                updateButtons(
                    playButton.classList.contains("hidden")
                );
            })
                .observe(playButton, {
                    attributeFilter: ["class"]
                })
        }
    };
    const rawFeaturesData = window.localStorage.getItem("enabled_features");
    let enabledOptionalFeatures = (rawFeaturesData !== null ? rawFeaturesData : "progressBar,savePosition,thumbarButtons,mediaKeys").split(",");
    const runOptionalFeatures = () => {
        enabledOptionalFeatures.forEach(feature => {
            (optionalFeatures[feature] || (() => { }))();
        })
    }
    runOptionalFeatures();
    const updateStorageFeatures = () => {
        window.localStorage.setItem("enabled_features", enabledOptionalFeatures.join(","));
    };

    // @ts-ignore
    window.enableFeature = new Proxy(optionalFeatures, {
        get(_, feature) {
            if (typeof feature !== "string" || !Object.keys(optionalFeatures).includes(feature)) return "Wrong name of feature!";
            if (enabledOptionalFeatures.includes(feature)) {
                return `Feature ${feature} already was enabled`;
            } else {
                enabledOptionalFeatures.push(feature);
                updateStorageFeatures();
                optionalFeatures[feature]();
                return `${feature} enabled`;
            }
        },
        set() {
            throw new Error("use it without =");
        }
    });
    Object.defineProperty(window, "enableAllFeatures", {
        get() {
            enabledOptionalFeatures = Object.keys(optionalFeatures);
            updateStorageFeatures();
            runOptionalFeatures();
            return "All optional features were enabled";
        }
    });
    Object.defineProperty(window, "disableAllFeatures", {
        get() {
            enabledOptionalFeatures = [];
            updateStorageFeatures();
            return "All optional features were disabled";
        }
    });
    // @ts-ignore
    window.disableFeature = new Proxy(optionalFeatures, {
        get(_, prop) {
            if (typeof prop !== "string" || !Object.keys(optionalFeatures).includes(prop)) return "Wrong name of feature!";
            if (!enabledOptionalFeatures.includes(prop)) {
                return `Feature ${prop} already was disabled`;
            } else {
                enabledOptionalFeatures.splice(
                    enabledOptionalFeatures.indexOf(prop), 1
                );
                window.localStorage.setItem("enabled_features", enabledOptionalFeatures.join(","));
                return `${prop} disabled`;
            }
        },
        set() {
            throw new Error("use it without =");
        }
    });
    // OPTIONAL FEATURES END
    // @ts-ignore
    ipcRenderer.on("inter-renderer-message", (_e, { channel, receiver, data }) => {
        // prevent spamming
        if (channel === "download-info") return;
        if (channel === "player-debug-info" && "torrent_downloaded" in data) return;
        console.log("%c[inner event %s] %o", "color: limegreen;", channel + " -> " + receiver, data);
    });
})();