define(["require", "exports", "component/content/Captor", "component/shared/Button", "util/FileSystem", "util/string/Language", "util/string/Translation"], function (require, exports, Captor_1, Button_1, FileSystem_1, Language_1, Translation_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getValidPath = void 0;
    let Store;
    const imageMagickCLIPaths = {
        win32: ["magick.exe", "convert.exe"],
        linux: ["magick", "convert"],
        darwin: ["magick", "convert"],
        aix: ["magick", "convert"],
        freebsd: ["magick", "convert"],
        openbsd: ["magick", "convert"],
        sunos: ["magick", "convert"],
    };
    class Options {
        constructor() {
            ////////////////////////////////////
            // Actual Options
            //
            // main
            this.projectFolders = [];
            // other programs
            this.OCRApplicationPath = "";
            this.imageMagickCLIPath = "";
            this.externalEditorCLIPath = "";
            this.glosserCLIPath = "";
            // external services
            this.OCRAggregatorServerURL = "";
            // appearance
            this.customTitleBar = process.platform === "win32";
            this.buttonDisplayMode = Button_1.ButtonDisplayMode.Normal;
        }
        static async initialize(req) {
            Store = req("electron-store");
            const store = new Store();
            window.options = new Proxy(Options.INSTANCE, {
                get(target, property) {
                    const key = property;
                    let val = store.get(`options.${key}`, target[key]);
                    if (Array.isArray(val)) {
                        val = new Proxy(val, {
                            get(arr, property2) {
                                arr = store.get(`options.${key}`, arr);
                                const key2 = property2;
                                const val2 = arr[key2];
                                if (typeof val2 === "function") {
                                    return (...args) => {
                                        const result = val2.apply(arr, args);
                                        store.set(`options.${key}`, arr);
                                        return result;
                                    };
                                }
                                return val2;
                            },
                            set(arr, property2, value) {
                                arr = store.get(`options.${key}`, arr);
                                const key2 = property2;
                                arr[key2] = value;
                                store.set(`options.${key}`, arr);
                                return true;
                            },
                        });
                    }
                    return val;
                },
                set(target, property, value) {
                    const key = property;
                    store.set(`options.${key}`, value);
                    target[key] = value;
                    return true;
                },
            });
            await Options.onInitialize();
            for (const handler of this.waitForOptionsHandlers)
                handler();
            this.waitForOptionsHandlers = [];
            Options.waitForOptions = Promise.resolve.bind(Promise);
        }
        static async reset(init = true) {
            const store = new Store();
            store.set("options", {});
            if (init)
                await Options.onInitialize();
        }
        static async onInitialize() {
            await Language_1.default.waitForLanguage();
            if (!await FileSystem_1.default.exists(options.OCRApplicationPath))
                options.OCRApplicationPath = "";
            if (!await FileSystem_1.default.exists(options.imageMagickCLIPath))
                options.imageMagickCLIPath = "";
            Button_1.default.setDisplayMode(options.buttonDisplayMode);
            this.setOCRAggregatorServerUrl(options.OCRAggregatorServerURL);
        }
        static async waitForOptions() {
            return new Promise(resolve => this.waitForOptionsHandlers.push(resolve));
        }
        static async chooseFile(title, validator, retryOnCancel = false, ...args) {
            let file;
            while (true) {
                file = undefined;
                const dialog = await window.send("dialog-show-open", {
                    properties: ["openFile"],
                    title: new Translation_1.default(title).get(...args),
                });
                if (!dialog.filePaths || !dialog.filePaths.length) {
                    if (retryOnCancel)
                        continue;
                    else
                        break;
                }
                file = dialog.filePaths[0].replace(/\\/g, "/");
                if (!validator || await validator(file))
                    break;
            }
            return file;
        }
        static async chooseFolder(title, validator, retryOnCancel = false) {
            let folder;
            while (true) {
                folder = undefined;
                const dialog = await window.send("dialog-show-open", {
                    properties: ["openDirectory"],
                    title: new Translation_1.default(title).get(),
                });
                if (!dialog.filePaths || !dialog.filePaths.length) {
                    if (retryOnCancel)
                        continue;
                    else
                        break;
                }
                folder = dialog.filePaths[0].replace(/\\/g, "/");
                if (!validator || await validator(folder))
                    break;
            }
            return folder;
        }
        static async chooseOCRApplicationPath() {
            const path = await this.chooseCLIFolder("prompt-ocr-application-cli", Captor_1.default.getCaptorPlatformPaths());
            if (path)
                options.OCRApplicationPath = path;
            Options.captor = await Captor_1.default.get(options.OCRApplicationPath);
        }
        static async chooseImageMagickCLIPath() {
            const path = await this.chooseCLIFolder("prompt-imagemagick-cli", imageMagickCLIPaths);
            if (path)
                options.imageMagickCLIPath = path;
        }
        static async chooseExternalEditorCLIPath(assign = true) {
            const path = await this.chooseFile("prompt-external-editor");
            if (assign && path)
                options.externalEditorCLIPath = path;
            return path;
        }
        static async chooseGlosserCLIPath() {
            const path = await this.chooseFile("prompt-glosser");
            if (path)
                options.glosserCLIPath = path;
        }
        static setOCRAggregatorServerUrl(inputUrl) {
            async function setFallbackCaptor() {
                Options.captor = await Captor_1.default.get(options.OCRApplicationPath);
                options.OCRAggregatorServerURL = "";
            }
            if (inputUrl) {
                try {
                    const url = new URL(inputUrl);
                    Options.captor = new Captor_1.OCRAggregatorServerCaptor(url);
                    options.OCRAggregatorServerURL = inputUrl;
                }
                catch {
                    setFallbackCaptor();
                }
            }
            else {
                setFallbackCaptor();
            }
        }
        static async chooseCLIFolder(prompt, paths) {
            let file;
            const folder = await this.chooseFolder(prompt, async (result) => {
                file = await getValidPath(result, paths);
                return !!file;
            }, false);
            return folder && `${folder}/${file}`;
        }
        getCaptor() {
            return Options.captor;
        }
    }
    Options.INSTANCE = new Options();
    ////////////////////////////////////
    // Setup
    //
    Options.waitForOptionsHandlers = [];
    exports.default = Options;
    async function getValidPath(path, platformPaths) {
        for (const filename of platformPaths[process.platform] || []) {
            if (await FileSystem_1.default.exists(`${path}/${filename}`)) {
                return filename;
            }
        }
        return undefined;
    }
    exports.getValidPath = getValidPath;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiT3B0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIk9wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztJQU1BLElBQUksS0FBa0IsQ0FBQztJQVF2QixNQUFNLG1CQUFtQixHQUFxQjtRQUM3QyxLQUFLLEVBQUUsQ0FBQyxZQUFZLEVBQUUsYUFBYSxDQUFDO1FBQ3BDLEtBQUssRUFBRSxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUM7UUFDNUIsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQztRQUM3QixHQUFHLEVBQUUsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDO1FBQzFCLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUM7UUFDOUIsT0FBTyxFQUFFLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQztRQUM5QixLQUFLLEVBQUUsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDO0tBQzVCLENBQUM7SUFFRixNQUFxQixPQUFPO1FBQTVCO1lBeUxDLG9DQUFvQztZQUNwQyxpQkFBaUI7WUFDakIsRUFBRTtZQUVGLE9BQU87WUFDQSxtQkFBYyxHQUFhLEVBQUUsQ0FBQztZQUVyQyxpQkFBaUI7WUFDVix1QkFBa0IsR0FBRyxFQUFFLENBQUM7WUFDeEIsdUJBQWtCLEdBQUcsRUFBRSxDQUFDO1lBQ3hCLDBCQUFxQixHQUFHLEVBQUUsQ0FBQztZQUMzQixtQkFBYyxHQUFHLEVBQUUsQ0FBQztZQUUzQixvQkFBb0I7WUFDYiwyQkFBc0IsR0FBVyxFQUFFLENBQUM7WUFFM0MsYUFBYTtZQUNOLG1CQUFjLEdBQUcsT0FBTyxDQUFDLFFBQVEsS0FBSyxPQUFPLENBQUM7WUFDOUMsc0JBQWlCLEdBQUcsMEJBQWlCLENBQUMsTUFBTSxDQUFDO1FBS3JELENBQUM7UUF0TU8sTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUUsR0FBb0I7WUFDbkQsS0FBSyxHQUFHLEdBQUcsQ0FBYyxnQkFBZ0IsQ0FBQyxDQUFDO1lBRTND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SUFDUixFQUFFO0lBRWEsOEJBQXNCLEdBQW1CLEVBQUUsQUFBckIsQ0FBc0I7c0JBUnZDLE9BQU87SUFrTnJCLEtBQUssVUFBVSxZQUFZLENBQUUsSUFBWSxFQUFFLGFBQStCO1FBQ2hGLEtBQUssTUFBTSxRQUFRLElBQUksYUFBYSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztZQUM5RCxJQUFJLE1BQU0sb0JBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJLElBQUksUUFBUSxFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUNwRCxPQUFPLFFBQVEsQ0FBQztZQUNqQixDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFQRCxvQ0FPQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBDYXB0b3IsIHsgT0NSQWdncmVnYXRvclNlcnZlckNhcHRvciB9IGZyb20gXCJjb21wb25lbnQvY29udGVudC9DYXB0b3JcIjtcbmltcG9ydCBCdXR0b24sIHsgQnV0dG9uRGlzcGxheU1vZGUgfSBmcm9tIFwiY29tcG9uZW50L3NoYXJlZC9CdXR0b25cIjtcbmltcG9ydCBGaWxlU3lzdGVtIGZyb20gXCJ1dGlsL0ZpbGVTeXN0ZW1cIjtcbmltcG9ydCBMYW5ndWFnZSBmcm9tIFwidXRpbC9zdHJpbmcvTGFuZ3VhZ2VcIjtcbmltcG9ydCBUcmFuc2xhdGlvbiBmcm9tIFwidXRpbC9zdHJpbmcvVHJhbnNsYXRpb25cIjtcblxubGV0IFN0b3JlOiBTdG9yZU1vZHVsZTtcblxuaW50ZXJmYWNlIFN0b3JlZERhdGEgZXh0ZW5kcyBNYWdpY2FsRGF0YSB7XG5cdG9wdGlvbnM6IFBhcnRpYWw8T3B0aW9ucz47XG59XG5cbmV4cG9ydCB0eXBlIFBsYXRmb3JtQ0xJUGF0aHMgPSB7IFtrZXkgaW4gTm9kZUpTLlBsYXRmb3JtXT86IHN0cmluZ1tdIH07XG5cbmNvbnN0IGltYWdlTWFnaWNrQ0xJUGF0aHM6IFBsYXRmb3JtQ0xJUGF0aHMgPSB7XG5cdHdpbjMyOiBbXCJtYWdpY2suZXhlXCIsIFwiY29udmVydC5leGVcIl0sXG5cdGxpbnV4OiBbXCJtYWdpY2tcIiwgXCJjb252ZXJ0XCJdLFxuXHRkYXJ3aW46IFtcIm1hZ2lja1wiLCBcImNvbnZlcnRcIl0sXG5cdGFpeDogW1wibWFnaWNrXCIsIFwiY29udmVydFwiXSxcblx0ZnJlZWJzZDogW1wibWFnaWNrXCIsIFwiY29udmVydFwiXSxcblx0b3BlbmJzZDogW1wibWFnaWNrXCIsIFwiY29udmVydFwiXSxcblx0c3Vub3M6IFtcIm1hZ2lja1wiLCBcImNvbnZlcnRcIl0sXG59O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBPcHRpb25zIHtcblx0cHJpdmF0ZSBzdGF0aWMgY2FwdG9yPzogQ2FwdG9yO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBJTlNUQU5DRSA9IG5ldyBPcHRpb25zKCk7XG5cblx0Ly8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cdC8vIFNldHVwXG5cdC8vXG5cblx0cHJpdmF0ZSBzdGF0aWMgd2FpdEZvck9wdGlvbnNIYW5kbGVyczogKCgpID0+IHZvaWQpW10gPSBbXTtcblxuXHRwdWJsaWMgc3RhdGljIGFzeW5jIGluaXRpYWxpemUgKHJlcTogUmVxdWlyZUZ1bmN0aW9uKSB7XG5cdFx0U3RvcmUgPSByZXE8U3RvcmVNb2R1bGU+KFwiZWxlY3Ryb24tc3RvcmVcIik7XG5cblx0XHRjb25zdCBzdG9yZSA9IG5ldyBTdG9yZTxTdG9yZWREYXRhPigpO1xuXG5cdFx0KHdpbmRvdyBhcyBhbnkpLm9wdGlvbnMgPSBuZXcgUHJveHkoT3B0aW9ucy5JTlNUQU5DRSwge1xuXHRcdFx0Z2V0ICh0YXJnZXQsIHByb3BlcnR5KSB7XG5cdFx0XHRcdGNvbnN0IGtleSA9IHByb3BlcnR5IGFzIGtleW9mIE9wdGlvbnM7XG5cdFx0XHRcdGxldCB2YWwgPSBzdG9yZS5nZXQoYG9wdGlvbnMuJHtrZXl9YCBhcyBhbnksIHRhcmdldFtrZXldKTtcblx0XHRcdFx0aWYgKEFycmF5LmlzQXJyYXkodmFsKSkge1xuXHRcdFx0XHRcdHZhbCA9IG5ldyBQcm94eSh2YWwsIHtcblx0XHRcdFx0XHRcdGdldCAoYXJyLCBwcm9wZXJ0eTIpIHtcblx0XHRcdFx0XHRcdFx0YXJyID0gc3RvcmUuZ2V0KGBvcHRpb25zLiR7a2V5fWAgYXMgYW55LCBhcnIpO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBrZXkyID0gcHJvcGVydHkyIGFzIGtleW9mIHR5cGVvZiBhcnI7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHZhbDIgPSBhcnJba2V5Ml07XG5cdFx0XHRcdFx0XHRcdGlmICh0eXBlb2YgdmFsMiA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuICguLi5hcmdzOiBhbnlbXSkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gdmFsMi5hcHBseShhcnIsIGFyZ3MpO1xuXHRcdFx0XHRcdFx0XHRcdFx0c3RvcmUuc2V0KGBvcHRpb25zLiR7a2V5fWAgYXMgYW55LCBhcnIpO1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHJldHVybiB2YWwyO1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHNldCAoYXJyLCBwcm9wZXJ0eTIsIHZhbHVlKSB7XG5cdFx0XHRcdFx0XHRcdGFyciA9IHN0b3JlLmdldChgb3B0aW9ucy4ke2tleX1gIGFzIGFueSwgYXJyKTtcblx0XHRcdFx0XHRcdFx0Y29uc3Qga2V5MiA9IHByb3BlcnR5MiBhcyBrZXlvZiB0eXBlb2YgYXJyO1xuXHRcdFx0XHRcdFx0XHRhcnJba2V5Ml0gPSB2YWx1ZTtcblx0XHRcdFx0XHRcdFx0c3RvcmUuc2V0KGBvcHRpb25zLiR7a2V5fWAgYXMgYW55LCBhcnIpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gdmFsO1xuXHRcdFx0fSxcblx0XHRcdHNldCAodGFyZ2V0LCBwcm9wZXJ0eSwgdmFsdWUpIHtcblx0XHRcdFx0Y29uc3Qga2V5ID0gcHJvcGVydHkgYXMga2V5b2YgT3B0aW9ucztcblx0XHRcdFx0c3RvcmUuc2V0KGBvcHRpb25zLiR7a2V5fWAgYXMgYW55LCB2YWx1ZSk7XG5cdFx0XHRcdHRhcmdldFtrZXldID0gdmFsdWUgYXMgbmV2ZXI7XG5cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXG5cdFx0YXdhaXQgT3B0aW9ucy5vbkluaXRpYWxpemUoKTtcblxuXHRcdGZvciAoY29uc3QgaGFuZGxlciBvZiB0aGlzLndhaXRGb3JPcHRpb25zSGFuZGxlcnMpIGhhbmRsZXIoKTtcblx0XHR0aGlzLndhaXRGb3JPcHRpb25zSGFuZGxlcnMgPSBbXTtcblx0XHRPcHRpb25zLndhaXRGb3JPcHRpb25zID0gUHJvbWlzZS5yZXNvbHZlLmJpbmQoUHJvbWlzZSkgYXMgYW55O1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBhc3luYyByZXNldCAoaW5pdCA9IHRydWUpIHtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBTdG9yZTxTdG9yZWREYXRhPigpO1xuXHRcdHN0b3JlLnNldChcIm9wdGlvbnNcIiwge30pO1xuXG5cdFx0aWYgKGluaXQpIGF3YWl0IE9wdGlvbnMub25Jbml0aWFsaXplKCk7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGFzeW5jIG9uSW5pdGlhbGl6ZSAoKSB7XG5cdFx0YXdhaXQgTGFuZ3VhZ2Uud2FpdEZvckxhbmd1YWdlKCk7XG5cdFx0aWYgKCFhd2FpdCBGaWxlU3lzdGVtLmV4aXN0cyhvcHRpb25zLk9DUkFwcGxpY2F0aW9uUGF0aCkpIG9wdGlvbnMuT0NSQXBwbGljYXRpb25QYXRoID0gXCJcIjtcblx0XHRpZiAoIWF3YWl0IEZpbGVTeXN0ZW0uZXhpc3RzKG9wdGlvbnMuaW1hZ2VNYWdpY2tDTElQYXRoKSkgb3B0aW9ucy5pbWFnZU1hZ2lja0NMSVBhdGggPSBcIlwiO1xuXHRcdEJ1dHRvbi5zZXREaXNwbGF5TW9kZShvcHRpb25zLmJ1dHRvbkRpc3BsYXlNb2RlKTtcblx0XHR0aGlzLnNldE9DUkFnZ3JlZ2F0b3JTZXJ2ZXJVcmwob3B0aW9ucy5PQ1JBZ2dyZWdhdG9yU2VydmVyVVJMKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgYXN5bmMgd2FpdEZvck9wdGlvbnMgKCkge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHRoaXMud2FpdEZvck9wdGlvbnNIYW5kbGVycy5wdXNoKHJlc29sdmUpKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgYXN5bmMgY2hvb3NlRmlsZSAodGl0bGU6IHN0cmluZywgdmFsaWRhdG9yOiAoKHJlc3VsdDogc3RyaW5nKSA9PiBib29sZWFuIHwgUHJvbWlzZTxib29sZWFuPikgfCB1bmRlZmluZWQsIHJldHJ5T25DYW5jZWw6IHRydWUsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxzdHJpbmc+O1xuXHRwdWJsaWMgc3RhdGljIGFzeW5jIGNob29zZUZpbGUgKHRpdGxlOiBzdHJpbmcsIHZhbGlkYXRvcj86IChyZXN1bHQ6IHN0cmluZykgPT4gYm9vbGVhbiB8IFByb21pc2U8Ym9vbGVhbj4pOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD47XG5cdHB1YmxpYyBzdGF0aWMgYXN5bmMgY2hvb3NlRmlsZSAodGl0bGU6IHN0cmluZywgdmFsaWRhdG9yPzogKHJlc3VsdDogc3RyaW5nKSA9PiBib29sZWFuIHwgUHJvbWlzZTxib29sZWFuPiwgcmV0cnlPbkNhbmNlbD86IGJvb2xlYW4sIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+O1xuXHRwdWJsaWMgc3RhdGljIGFzeW5jIGNob29zZUZpbGUgKHRpdGxlOiBzdHJpbmcsIHZhbGlkYXRvcj86IChyZXN1bHQ6IHN0cmluZykgPT4gYm9vbGVhbiB8IFByb21pc2U8Ym9vbGVhbj4sIHJldHJ5T25DYW5jZWwgPSBmYWxzZSwgLi4uYXJnczogYW55W10pIHtcblx0XHRsZXQgZmlsZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRmaWxlID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRjb25zdCBkaWFsb2cgPSBhd2FpdCB3aW5kb3cuc2VuZDxFbGVjdHJvbi5PcGVuRGlhbG9nUmV0dXJuVmFsdWU+KFwiZGlhbG9nLXNob3ctb3BlblwiLCB7XG5cdFx0XHRcdHByb3BlcnRpZXM6IFtcIm9wZW5GaWxlXCJdLFxuXHRcdFx0XHR0aXRsZTogbmV3IFRyYW5zbGF0aW9uKHRpdGxlKS5nZXQoLi4uYXJncyksXG5cdFx0XHR9IGFzIEVsZWN0cm9uLk9wZW5EaWFsb2dPcHRpb25zKTtcblxuXHRcdFx0aWYgKCFkaWFsb2cuZmlsZVBhdGhzIHx8ICFkaWFsb2cuZmlsZVBhdGhzLmxlbmd0aCkge1xuXHRcdFx0XHRpZiAocmV0cnlPbkNhbmNlbCkgY29udGludWU7XG5cdFx0XHRcdGVsc2UgYnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdGZpbGUgPSBkaWFsb2cuZmlsZVBhdGhzWzBdLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpO1xuXHRcdFx0aWYgKCF2YWxpZGF0b3IgfHwgYXdhaXQgdmFsaWRhdG9yKGZpbGUpKSBicmVhaztcblx0XHR9XG5cblx0XHRyZXR1cm4gZmlsZTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgYXN5bmMgY2hvb3NlRm9sZGVyICh0aXRsZTogc3RyaW5nLCB2YWxpZGF0b3I6ICgocmVzdWx0OiBzdHJpbmcpID0+IGJvb2xlYW4gfCBQcm9taXNlPGJvb2xlYW4+KSB8IHVuZGVmaW5lZCwgcmV0cnlPbkNhbmNlbDogdHJ1ZSk6IFByb21pc2U8c3RyaW5nPjtcblx0cHVibGljIHN0YXRpYyBhc3luYyBjaG9vc2VGb2xkZXIgKHRpdGxlOiBzdHJpbmcsIHZhbGlkYXRvcj86IChyZXN1bHQ6IHN0cmluZykgPT4gYm9vbGVhbiB8IFByb21pc2U8Ym9vbGVhbj4pOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD47XG5cdHB1YmxpYyBzdGF0aWMgYXN5bmMgY2hvb3NlRm9sZGVyICh0aXRsZTogc3RyaW5nLCB2YWxpZGF0b3I/OiAocmVzdWx0OiBzdHJpbmcpID0+IGJvb2xlYW4gfCBQcm9taXNlPGJvb2xlYW4+LCByZXRyeU9uQ2FuY2VsPzogYm9vbGVhbik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPjtcblx0cHVibGljIHN0YXRpYyBhc3luYyBjaG9vc2VGb2xkZXIgKHRpdGxlOiBzdHJpbmcsIHZhbGlkYXRvcj86IChyZXN1bHQ6IHN0cmluZykgPT4gYm9vbGVhbiB8IFByb21pc2U8Ym9vbGVhbj4sIHJldHJ5T25DYW5jZWwgPSBmYWxzZSkge1xuXHRcdGxldCBmb2xkZXI6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0Zm9sZGVyID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRjb25zdCBkaWFsb2cgPSBhd2FpdCB3aW5kb3cuc2VuZDxFbGVjdHJvbi5PcGVuRGlhbG9nUmV0dXJuVmFsdWU+KFwiZGlhbG9nLXNob3ctb3BlblwiLCB7XG5cdFx0XHRcdHByb3BlcnRpZXM6IFtcIm9wZW5EaXJlY3RvcnlcIl0sXG5cdFx0XHRcdHRpdGxlOiBuZXcgVHJhbnNsYXRpb24odGl0bGUpLmdldCgpLFxuXHRcdFx0fSBhcyBFbGVjdHJvbi5PcGVuRGlhbG9nT3B0aW9ucyk7XG5cblx0XHRcdGlmICghZGlhbG9nLmZpbGVQYXRocyB8fCAhZGlhbG9nLmZpbGVQYXRocy5sZW5ndGgpIHtcblx0XHRcdFx0aWYgKHJldHJ5T25DYW5jZWwpIGNvbnRpbnVlO1xuXHRcdFx0XHRlbHNlIGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHRmb2xkZXIgPSBkaWFsb2cuZmlsZVBhdGhzWzBdLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpO1xuXHRcdFx0aWYgKCF2YWxpZGF0b3IgfHwgYXdhaXQgdmFsaWRhdG9yKGZvbGRlcikpIGJyZWFrO1xuXHRcdH1cblxuXHRcdHJldHVybiBmb2xkZXI7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGFzeW5jIGNob29zZU9DUkFwcGxpY2F0aW9uUGF0aCAoKSB7XG5cdFx0Y29uc3QgcGF0aCA9IGF3YWl0IHRoaXMuY2hvb3NlQ0xJRm9sZGVyKFwicHJvbXB0LW9jci1hcHBsaWNhdGlvbi1jbGlcIiwgQ2FwdG9yLmdldENhcHRvclBsYXRmb3JtUGF0aHMoKSk7XG5cdFx0aWYgKHBhdGgpIG9wdGlvbnMuT0NSQXBwbGljYXRpb25QYXRoID0gcGF0aDtcblx0XHRPcHRpb25zLmNhcHRvciA9IGF3YWl0IENhcHRvci5nZXQob3B0aW9ucy5PQ1JBcHBsaWNhdGlvblBhdGgpO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBhc3luYyBjaG9vc2VJbWFnZU1hZ2lja0NMSVBhdGggKCkge1xuXHRcdGNvbnN0IHBhdGggPSBhd2FpdCB0aGlzLmNob29zZUNMSUZvbGRlcihcInByb21wdC1pbWFnZW1hZ2ljay1jbGlcIiwgaW1hZ2VNYWdpY2tDTElQYXRocyk7XG5cdFx0aWYgKHBhdGgpIG9wdGlvbnMuaW1hZ2VNYWdpY2tDTElQYXRoID0gcGF0aDtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgYXN5bmMgY2hvb3NlRXh0ZXJuYWxFZGl0b3JDTElQYXRoIChhc3NpZ24gPSB0cnVlKSB7XG5cdFx0Y29uc3QgcGF0aCA9IGF3YWl0IHRoaXMuY2hvb3NlRmlsZShcInByb21wdC1leHRlcm5hbC1lZGl0b3JcIik7XG5cdFx0aWYgKGFzc2lnbiAmJiBwYXRoKSBvcHRpb25zLmV4dGVybmFsRWRpdG9yQ0xJUGF0aCA9IHBhdGg7XG5cdFx0cmV0dXJuIHBhdGg7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGFzeW5jIGNob29zZUdsb3NzZXJDTElQYXRoICgpIHtcblx0XHRjb25zdCBwYXRoID0gYXdhaXQgdGhpcy5jaG9vc2VGaWxlKFwicHJvbXB0LWdsb3NzZXJcIik7XG5cdFx0aWYgKHBhdGgpIG9wdGlvbnMuZ2xvc3NlckNMSVBhdGggPSBwYXRoO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBzZXRPQ1JBZ2dyZWdhdG9yU2VydmVyVXJsKGlucHV0VXJsOiBzdHJpbmcpIHtcblx0XHRhc3luYyBmdW5jdGlvbiBzZXRGYWxsYmFja0NhcHRvcigpIHtcblx0XHRcdE9wdGlvbnMuY2FwdG9yID0gYXdhaXQgQ2FwdG9yLmdldChvcHRpb25zLk9DUkFwcGxpY2F0aW9uUGF0aCk7XG5cdFx0XHRvcHRpb25zLk9DUkFnZ3JlZ2F0b3JTZXJ2ZXJVUkwgPSBcIlwiO1xuXHRcdH1cblxuXHRcdGlmKGlucHV0VXJsKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCB1cmwgPSBuZXcgVVJMKGlucHV0VXJsKTtcblx0XHRcdFx0T3B0aW9ucy5jYXB0b3IgPSBuZXcgT0NSQWdncmVnYXRvclNlcnZlckNhcHRvcih1cmwpO1xuXHRcdFx0XHRvcHRpb25zLk9DUkFnZ3JlZ2F0b3JTZXJ2ZXJVUkwgPSBpbnB1dFVybDtcblx0XHRcdH1cblx0XHRcdGNhdGNoIHtcblx0XHRcdFx0c2V0RmFsbGJhY2tDYXB0b3IoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRzZXRGYWxsYmFja0NhcHRvcigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIGFzeW5jIGNob29zZUNMSUZvbGRlciAocHJvbXB0OiBzdHJpbmcsIHBhdGhzOiBQbGF0Zm9ybUNMSVBhdGhzKSB7XG5cdFx0bGV0IGZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBmb2xkZXIgPSBhd2FpdCB0aGlzLmNob29zZUZvbGRlcihwcm9tcHQsIGFzeW5jIHJlc3VsdCA9PiB7XG5cdFx0XHRmaWxlID0gYXdhaXQgZ2V0VmFsaWRQYXRoKHJlc3VsdCwgcGF0aHMpO1xuXHRcdFx0cmV0dXJuICEhZmlsZTtcblx0XHR9LCBmYWxzZSk7XG5cblx0XHRyZXR1cm4gZm9sZGVyICYmIGAke2ZvbGRlcn0vJHtmaWxlfWA7XG5cdH1cblxuXG5cdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXHQvLyBBY3R1YWwgT3B0aW9uc1xuXHQvL1xuXG5cdC8vIG1haW5cblx0cHVibGljIHByb2plY3RGb2xkZXJzOiBzdHJpbmdbXSA9IFtdO1xuXG5cdC8vIG90aGVyIHByb2dyYW1zXG5cdHB1YmxpYyBPQ1JBcHBsaWNhdGlvblBhdGggPSBcIlwiO1xuXHRwdWJsaWMgaW1hZ2VNYWdpY2tDTElQYXRoID0gXCJcIjtcblx0cHVibGljIGV4dGVybmFsRWRpdG9yQ0xJUGF0aCA9IFwiXCI7XG5cdHB1YmxpYyBnbG9zc2VyQ0xJUGF0aCA9IFwiXCI7XG5cblx0Ly8gZXh0ZXJuYWwgc2VydmljZXNcblx0cHVibGljIE9DUkFnZ3JlZ2F0b3JTZXJ2ZXJVUkw6IHN0cmluZyA9IFwiXCI7XG5cblx0Ly8gYXBwZWFyYW5jZVxuXHRwdWJsaWMgY3VzdG9tVGl0bGVCYXIgPSBwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCI7XG5cdHB1YmxpYyBidXR0b25EaXNwbGF5TW9kZSA9IEJ1dHRvbkRpc3BsYXlNb2RlLk5vcm1hbDtcblxuXHRwdWJsaWMgZ2V0Q2FwdG9yICgpIHtcblx0XHRyZXR1cm4gT3B0aW9ucy5jYXB0b3I7XG5cdH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFZhbGlkUGF0aCAocGF0aDogc3RyaW5nLCBwbGF0Zm9ybVBhdGhzOiBQbGF0Zm9ybUNMSVBhdGhzKSB7XG5cdGZvciAoY29uc3QgZmlsZW5hbWUgb2YgcGxhdGZvcm1QYXRoc1twcm9jZXNzLnBsYXRmb3JtXSB8fCBbXSkge1xuXHRcdGlmIChhd2FpdCBGaWxlU3lzdGVtLmV4aXN0cyhgJHtwYXRofS8ke2ZpbGVuYW1lfWApKSB7XG5cdFx0XHRyZXR1cm4gZmlsZW5hbWU7XG5cdFx0fVxuXHR9XG5cdHJldHVybiB1bmRlZmluZWQ7XG59XG4iXX0=