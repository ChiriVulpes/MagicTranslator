import Button, { ButtonDisplayMode } from "component/shared/Button";
import FileSystem from "util/FileSystem";
import Language from "util/string/Language";
import Translation from "util/string/Translation";

let Dialog: typeof Electron.dialog;
let Store: StoreModule;

interface StoredData extends MagicalData {
	options: Partial<Options>;
}

type PlatformCLIPaths = { [key in NodeJS.Platform]?: string[] };

const capture2TextCLIPaths: PlatformCLIPaths = {
	win32: ["Capture2Text_CLI.exe"],
};

const imageMagickCLIPaths: PlatformCLIPaths = {
	win32: ["magick.exe", "convert.exe"],
	linux: ["magick", "convert"],
	darwin: ["magick", "convert"],
	aix: ["magick", "convert"],
	freebsd: ["magick", "convert"],
	openbsd: ["magick", "convert"],
	sunos: ["magick", "convert"],
};

export default class Options {

	private static readonly INSTANCE = new Options();

	////////////////////////////////////
	// Setup
	//

	private static waitForOptionsHandlers: (() => void)[] = [];

	public static async initialize (req: RequireFunction) {
		Store = req<StoreModule>("electron-store");
		const electron = req<typeof Electron>("electron").remote;
		Dialog = electron.dialog;

		const store = new Store<StoredData>();

		(window as any).options = new Proxy(Options.INSTANCE, {
			get (target, property) {
				const key = property as keyof Options;
				let val = store.get(`options.${key}` as any, target[key]);
				if (Array.isArray(val)) {
					val = new Proxy(val, {
						get (arr, property2) {
							arr = store.get(`options.${key}` as any, arr);
							const key2 = property2 as keyof typeof arr;
							const val2 = arr[key2];
							if (typeof val2 === "function") {
								return (...args: any[]) => {
									const result = val2.apply(arr, args);
									store.set(`options.${key}` as any, arr);
									return result;
								};
							}
							return val2;
						},
						set (arr, property2, value) {
							arr = store.get(`options.${key}` as any, arr);
							const key2 = property2 as keyof typeof arr;
							arr[key2] = value;
							store.set(`options.${key}` as any, arr);
							return true;
						},
					});
				}

				return val;
			},
			set (target, property, value) {
				const key = property as keyof Options;
				store.set(`options.${key}` as any, value);
				target[key] = value;

				return true;
			},
		});

		await Options.onInitialize();

		for (const handler of this.waitForOptionsHandlers) handler();
		delete this.waitForOptionsHandlers;
		Options.waitForOptions = Promise.resolve.bind(Promise) as any;
	}

	public static async reset (init = true) {
		const store = new Store<StoredData>();
		store.set("options", {});

		if (init) await Options.onInitialize();
	}

	public static async onInitialize () {
		await Language.waitForLanguage();
		if (!await FileSystem.exists(options.capture2TextCLIPath)) options.capture2TextCLIPath = "";
		if (!await FileSystem.exists(options.imageMagickCLIPath)) options.imageMagickCLIPath = "";
		Button.setDisplayMode(options.buttonDisplayMode);
	}

	public static async waitForOptions () {
		return new Promise(resolve => this.waitForOptionsHandlers.push(resolve));
	}

	public static async chooseFile (title: string, validator: ((result: string) => boolean | Promise<boolean>) | undefined, retryOnCancel: true, ...args: any[]): Promise<string>;
	public static async chooseFile (title: string, validator?: (result: string) => boolean | Promise<boolean>): Promise<string | undefined>;
	public static async chooseFile (title: string, validator?: (result: string) => boolean | Promise<boolean>, retryOnCancel?: boolean, ...args: any[]): Promise<string | undefined>;
	public static async chooseFile (title: string, validator?: (result: string) => boolean | Promise<boolean>, retryOnCancel = false, ...args: any[]) {
		let file: string | undefined;
		while (true) {
			file = undefined;

			const result = await new Promise<string[] | undefined>(resolve => Dialog.showOpenDialog({
				properties: ["openFile"],
				title: new Translation(title).get(...args),
			}, resolve));

			if (!result) {
				if (retryOnCancel) continue;
				else break;
			}

			file = result[0].replace(/\\/g, "/");
			if (!validator || await validator(file)) break;
		}

		return file;
	}

	public static async chooseFolder (title: string, validator: ((result: string) => boolean | Promise<boolean>) | undefined, retryOnCancel: true): Promise<string>;
	public static async chooseFolder (title: string, validator?: (result: string) => boolean | Promise<boolean>): Promise<string | undefined>;
	public static async chooseFolder (title: string, validator?: (result: string) => boolean | Promise<boolean>, retryOnCancel?: boolean): Promise<string | undefined>;
	public static async chooseFolder (title: string, validator?: (result: string) => boolean | Promise<boolean>, retryOnCancel = false) {
		let folder: string | undefined;
		while (true) {
			folder = undefined;

			const result = await new Promise<string[] | undefined>(resolve => Dialog.showOpenDialog({
				properties: ["openDirectory"],
				title: new Translation(title).get(),
			}, resolve));

			if (!result) {
				if (retryOnCancel) continue;
				else break;
			}

			folder = result[0].replace(/\\/g, "/");
			if (!validator || await validator(folder)) break;
		}

		return folder;
	}

	public static async chooseCapture2TextCLIPath () {
		const path = await this.chooseCLIFolder("prompt-capture2text-cli", ...capture2TextCLIPaths[process.platform] || []);
		if (path) options.imageMagickCLIPath = path;
	}

	public static async chooseImageMagickCLIPath () {
		const path = await this.chooseCLIFolder("prompt-imagemagick-cli", ...imageMagickCLIPaths[process.platform] || []);
		if (path) options.imageMagickCLIPath = path;
	}

	public static async chooseExternalEditorPath () {
		const path = await this.chooseFile("prompt-external-editor");
		if (path) options.externalEditorPath = path;
	}

	private static async chooseCLIFolder (prompt: string, ...filenames: string[]) {
		let file!: string;
		const folder = await this.chooseFolder(prompt, async result => {
			for (const filename of filenames) {
				if (await FileSystem.exists(`${result}/${filename}`)) {
					file = filename;
					return true;
				}
			}
			return false;
		}, false);

		return folder && `${folder}/${file}`;
	}

	////////////////////////////////////
	// Actual Options
	//

	// main
	public projectFolders: string[] = [];

	// other programs
	public capture2TextCLIPath: string = "";
	public imageMagickCLIPath: string = "";
	public externalEditorPath: string = "";

	// appearance
	public customTitleBar = process.platform === "win32";
	public buttonDisplayMode = ButtonDisplayMode.Normal;
}
