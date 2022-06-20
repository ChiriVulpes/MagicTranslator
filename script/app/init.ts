/// <reference path="../Common.d.ts" />
import { app, BrowserWindow, ipcMain, Menu, protocol, screen, WebContents } from "electron";
import * as path from "path";
// tslint:disable-next-line
const Store = require("electron-store") as StoreModule;

const store = new Store<MagicalData>();
let mainWindow: BrowserWindow;


function on (windowEvent: WindowEvent, listener: (event: IpcEvent, ...args: any[]) => any) {
	ipcMain.on(windowEvent, (event: IpcEvent, ...args: any[]) => {
		const result = listener(event, ...args);
		if (!(event.sender as WebContents).isDestroyed()) {
			event.sender.send(windowEvent, result);
		}
	});
}

// function send (windowEvent: WindowEvent) {
// 	mainWindow.webContents.send(windowEvent);
// }

function createWindow () {
	protocol.registerFileProtocol('chiri', (request, callback) => {
		callback({
			path: path.normalize(decodeURIComponent(request.url.replace(/^chiri:\/+|\?.*$/g, ""))),
			headers: { "Content-Security-Policy": "default-src *" },
		});
	});

	Menu.setApplicationMenu(null);

	const width = store.get("window.width", 800);
	const height = store.get("window.height", 600);
	const screenOffset = store.get("window.screenOffset", 0);
	const display = screen.getDisplayNearestPoint({ x: screenOffset, y: 0 }).workArea;

	mainWindow = new BrowserWindow({
		show: false,
		frame: !store.get("options.customTitleBar", process.platform === "win32"),
		minWidth: 1000,
		minHeight: 600,
		width,
		height,
		x: Math.floor(display.x + display.width / 2 - width / 2),
		y: Math.floor(display.height / 2 - height / 2),
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			contextIsolation: false,
		},
	});

	mainWindow.webContents.setIgnoreMenuShortcuts(true);
	mainWindow.setMenu(null);

	// win.webContents.on("before-input-event", event => event.preventDefault());

	if (store.get("window.maximized")) {
		mainWindow.maximize();
	}

	if (store.get("window.devtools")) {
		mainWindow.webContents.openDevTools();
	}


	let storeTimeout: NodeJS.Timer | undefined;
	function storeWindowPosition () {
		if (storeTimeout) clearTimeout(storeTimeout);

		storeTimeout = setTimeout(() => {
			if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
				store.set("window.width", mainWindow.getBounds().width);
				store.set("window.height", mainWindow.getBounds().height);
			}

			// add 100 to make sure it opens on the secondary monitor if that's where it was open last (we don't restore the exact screen position anyway)
			store.set("window.screenOffset", mainWindow.getBounds().x + 100);
			store.set("window.maximized", mainWindow.isMaximized());
		}, 100);
	}

	mainWindow.on("move", storeWindowPosition);
	mainWindow.on("resize", storeWindowPosition);

	mainWindow.webContents.on("devtools-opened", () => store.set("window.devtools", true));
	mainWindow.webContents.on("devtools-closed", () => store.set("window.devtools", false));


	////////////////////////////////////
	// Load the page!
	//

	mainWindow.loadURL("data:text/html;charset=UTF-8," + encodeURIComponent(`
		<link rel="stylesheet" href="style/index.css">
		<script>
			const { webFrame } = require("electron");
			webFrame.setVisualZoomLevelLimits(1, 1);

			window.Stream = require("@wayward/goodstream").default;
			require("@wayward/goodstream/apply");

			window.nodeRequire = require;
			delete window.require;
			delete window.exports;
			delete window.module;
		</script>
		<script src="script/vendor/require.js"></script>
		<script>
			requirejs(["script/init/Decorator.js"], () => {
				requirejs(["script/index.js"]);
			});
		</script>
	`), { baseURLForDataURL: `chiri://${__dirname}/out`, extraHeaders: "pragma: no-cache\n" });

	mainWindow.on("ready-to-show", () => mainWindow.show());
}

async function init () {
	await new Promise(resolve => app.on("ready", resolve));

	createWindow();

	on("window-is-maximized", () => mainWindow.isMaximized());
	on("window-is-fullscreen", () => mainWindow.isFullScreen());
	on("window-toggle-fullscreen", () => mainWindow.setFullScreen(!mainWindow.isFullScreen()));
	on("window-close", () => mainWindow.close());
	on("window-maximize", () => mainWindow.maximize());
	on("window-minimize", () => mainWindow.minimize());
	on("window-restore", () => mainWindow.unmaximize());
	on("window-toggle-devtools", () => mainWindow.webContents.toggleDevTools());
	on("get-locale", () => app.getLocale());
	on("window-restart", async () => {
		const oldWindow = mainWindow;
		createWindow();
		oldWindow.close();
	});
}

init();
