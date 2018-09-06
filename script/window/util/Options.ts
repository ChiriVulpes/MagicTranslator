import Translation from "util/string/Translation";

let Dialog: typeof Electron.dialog;
let Store: StoreModule;

interface StoredData extends MagicalData {
	options: Partial<Options>;
}

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
				return store.get(`options.${key}` as any, target[key]);
			},
			set (target, property, value) {
				const key = property as keyof Options;
				if (!(key in target) || value !== target[key]) {
					store.set(`options.${key}` as any, value);
					target[key] = value;
				}

				return true;
			},
		});

		await Options.onInitialize();

		for (const handler of this.waitForOptionsHandlers) handler();
		delete this.waitForOptionsHandlers;
		Options.waitForOptions = Promise.resolve.bind(Promise);
	}

	public static async reset (init = true) {
		const store = new Store<StoredData>();
		store.set("options", {});

		if (init) await Options.onInitialize();
	}

	public static async onInitialize () {
		if (!options.root) options.root = await Options.chooseRootFolder();
		if (!options.capture2TextCLIPath) options.capture2TextCLIPath = await Options.chooseCapture2TextCLIPath();
	}

	public static async waitForOptions () {
		return new Promise(resolve => this.waitForOptionsHandlers.push(resolve));
	}

	public static async chooseFile (title: string, validator: ((result: string) => boolean | Promise<boolean>) | undefined, retryOnCancel: true): Promise<string>;
	public static async chooseFile (title: string, validator?: (result: string) => boolean | Promise<boolean>): Promise<string | undefined>;
	public static async chooseFile (title: string, validator?: (result: string) => boolean | Promise<boolean>, retryOnCancel?: boolean): Promise<string | undefined>;
	public static async chooseFile (title: string, validator?: (result: string) => boolean | Promise<boolean>, retryOnCancel = false) {
		let file: string | undefined;
		while (true) {
			const result = await new Promise<string[] | undefined>(resolve => Dialog.showOpenDialog({
				properties: ["openFile"],
				title: new Translation(title).get(),
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
			const result = await new Promise<string[] | undefined>(resolve => Dialog.showOpenDialog({
				properties: ["openDirectory"],
				title,
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

	private static async chooseRootFolder () {
		return this.chooseFolder("prompt-root-folder", undefined, true);
	}

	private static async chooseCapture2TextCLIPath () {
		const folder = await this.chooseFolder("prompt-cap-2-text-cli", result => fs.exists(`${result}/Capture2Text_CLI.exe`), true);
		return `${folder}/Capture2Text_CLI.exe`;
	}

	////////////////////////////////////
	// Actual Options
	//

	public root: string;
	public capture2TextCLIPath: string;
}
