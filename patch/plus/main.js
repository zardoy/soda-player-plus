//FEATURE: fix cli - fullscreen flag support. and remove flags from input

const enableFullscreen = process.argv.includes("--fullscreen");
// remove flags since sodaPlayer treats them as input file
process.argv = process.argv.filter(arg => !arg.startsWith("--"));
//FEATURE END

require("../js/main/main.js");

(async () => {
    require("electron").app.on("ready", () => {
        // require("electron").ipcMain.addListener("inter-renderer-message", (_e, ...args) => console.log(args));
        const window = require("electron").BrowserWindow.getAllWindows()[1];
        if (enableFullscreen) {
            void window.webContents.executeJavaScript(`document.documentElement.webkitRequestFullscreen()`, true);
        }
    })
})();