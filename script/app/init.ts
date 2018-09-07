/// <reference path="../Common.d.ts" />
import { app, BrowserWindow, ipcMain, screen } from "electron";
// tslint:disable-next-line
const Store = require("electron-store") as StoreModule;


function on (windowEvent: WindowEvent, listener: (event: IpcEvent, ...args: any[]) => any) {
	ipcMain.on(windowEvent, (event: IpcEvent, ...args: any[]) => {
		event.sender.send(windowEvent, listener(event, ...args));
	});
}

let mainWindow: BrowserWindow;
function send (windowEvent: WindowEvent) {
	mainWindow.webContents.send(windowEvent);
}

async function init () {
	await new Promise(resolve => app.on("ready", resolve));


	const store = new Store<MagicalData>();

	const width = store.get("window.width", 800), height = store.get("window.height", 600);
	const screenOffset = store.get("window.screenOffset", 0);
	const display = screen.getDisplayNearestPoint({ x: screenOffset, y: 0 }).workArea;

	const win = mainWindow = new BrowserWindow({
		show: false,
		frame: false,
		minWidth: 800,
		minHeight: 600,
		width,
		height,
		x: Math.floor(display.x + display.width / 2 - width / 2),
		y: Math.floor(display.height / 2 - height / 2),
	});

	win.webContents.setIgnoreMenuShortcuts(true);

	// win.webContents.on("before-input-event", event => event.preventDefault());

	if (store.get("window.maximized")) {
		win.maximize();
	}

	if (store.get("window.devtools")) {
		win.webContents.openDevTools();
	}


	on("window-is-maximized", () => win.isMaximized());
	on("window-is-fullscreen", () => win.isFullScreen());
	on("window-close", () => win.close());
	on("window-maximize", () => win.maximize());
	on("window-minimize", () => win.minimize());
	on("window-restore", () => win.unmaximize());
	on("window-toggle-devtools", () => win.webContents.toggleDevTools());
	on("get-locale", () => app.getLocale());

	win.on("app-command", (e, command) => {
		if (command === "browser-backward") send("window-back");
		else if (command === "browser-forward") send("window-forward");
	});


	let storeTimeout: NodeJS.Timer | undefined;
	function storeWindowPosition () {
		if (storeTimeout) clearTimeout(storeTimeout);

		storeTimeout = setTimeout(() => {
			if (!win.isMaximized() && !win.isFullScreen()) {
				store.set("window.width", win.getBounds().width);
				store.set("window.height", win.getBounds().height);
			}

			// add 100 to make sure it opens on the secondary monitor if that's where it was open last (we don't restore the exact screen position anyway)
			store.set("window.screenOffset", win.getBounds().x + 100);
			store.set("window.maximized", win.isMaximized());
		}, 100);
	}

	win.on("move", storeWindowPosition);
	win.on("resize", storeWindowPosition);

	win.webContents.on("devtools-opened", () => store.set("window.devtools", true));
	win.webContents.on("devtools-closed", () => store.set("window.devtools", false));


	////////////////////////////////////
	// Load the page!
	//

	win.loadURL("data:text/html;charset=UTF-8," + encodeURIComponent(`
		<link rel="stylesheet" href="style/index.css">
		<script>
			const { webFrame } = require("electron");
			webFrame.setVisualZoomLevelLimits(1, 1);
			webFrame.setLayoutZoomLevelLimits(0, 0);

			window.nodeRequire = require;
			delete window.require;
			delete window.exports;
			delete window.module;
		</script>
		<script src="script/vendor/require.js" data-main="script/index.js"></script>
	`), { baseURLForDataURL: `file://${__dirname}/out`, extraHeaders: "pragma: no-cache\n" });

	win.on("ready-to-show", () => win.show());
}

init();
