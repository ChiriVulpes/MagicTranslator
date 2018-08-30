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

	private static async chooseRootFolder () {
		let result: string[] | undefined;
		while (true) {
			result = await new Promise<string[] | undefined>(resolve => Dialog.showOpenDialog({
				properties: ["openDirectory"],
				title: "Choose Root Folder (Folder Containing vol##/ch### folders)",
			}, resolve));

			if (result) break;
		}

		return result[0].replace(/\\/g, "/");
	}

	private static async chooseCapture2TextCLIPath () {
		let cliPath: string;
		while (true) {
			const result = await new Promise<string[] | undefined>(resolve => Dialog.showOpenDialog({
				properties: ["openDirectory"],
				title: "Choose Capture2Text Folder (Folder Containing Capture2Text_CLI.exe)",
			}, resolve));

			if (!result) continue;

			cliPath = `${result[0]}/Capture2Text_CLI.exe`;
			if (await fs.exists(cliPath)) break;
		}

		return cliPath.replace(/\\/g, "/");
	}

	////////////////////////////////////
	// Actual Options
	//

	public root: string;
	public capture2TextCLIPath: string;
}
