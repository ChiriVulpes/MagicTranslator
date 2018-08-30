type WindowEvent =
	"window-is-maximized" |
	"window-is-fullscreen" |
	"window-minimize" |
	"window-maximize" |
	"window-restore" |
	"window-close" |
	"window-back" |
	"window-forward" |
	"window-get-position" |
	"get-locale";

interface IpcEvent {
	returnValue: any;
	sender: {
		send (event: WindowEvent, ...args: any[]): void;
	};
}

interface MagicalData {
	"window.width": number;
	"window.height": number;
	"window.maximized": boolean;
	"window.screenOffset": number;
	"window.devtools": boolean;
}

interface StoreModule {
	new <O extends { [key in K]?: any } = { [key in K]?: any }, K extends string | number | symbol = keyof O>(): Store<O, K>;
}

interface Store<O extends { [key in K]?: any } = { [key in K]?: any }, K extends string | number | symbol = keyof O> {
	store: O;
	get<GK extends K> (name: GK, defaultValue?: O[GK]): O[GK];
	set<SK extends K> (name: SK, value: O[SK]): void;
	has (name: string | number | symbol): name is K;
	delete<DK extends K> (name: DK): void;
}
