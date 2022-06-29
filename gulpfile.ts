import { build, Platform } from "electron-builder";
import gulpSass from "gulp-sass";
import sass from "sass";
import Electron from "./gulp/Electron";
import Task, { Pipe, remove, Series, symlink, watch } from "./gulp/Task";
import TypescriptWatch from "./gulp/TypescriptWatch";

const sassCompiler = gulpSass(sass);

////////////////////////////////////
// Scripts
//

const scriptWindow = new TypescriptWatch("script/window", "out/script")
	.setDeclaration("out/defs")
	.onComplete(Electron.restart);

async function watchScriptWindow () {
	return scriptWindow.watch().waitForInitial();
}

const scriptApp = new TypescriptWatch("script/app", "out")
	.onComplete(Electron.restart);

async function watchScriptApp () {
	return scriptApp.watch().waitForInitial();
}

const style = new Pipe("style", "style/**/*.scss")
	.pipe(sassCompiler)
	.pipe("out/style");

const statik = new Pipe("static", ["static/**/*", "!static/node_modules/**/*"])
	.pipe("out");

const nodeModules = new Pipe("node-modules", "script/window/node_modules")
	.pipe(symlink("out"));

const nodeModulesCopy = new Pipe("node-modules", "script/window/node_modules/**/*")
	.pipe("out/node_modules");

////////////////////////////////////
// Tasks
//

new Task("watch", remove("out"))
	.then(watchScriptWindow, watchScriptApp, style, statik, nodeModules)
	.then(Electron.start("out"))
	.then(
		watch("style/**/*.scss", new Series(style).then(Electron.restart)),
		watch(["static/**/*", "!static/node_modules/**/*"], new Series(statik).then(Electron.restart)))
	.create();

new Task("build", remove(["dist", "out"]))
	.then(scriptWindow.compile, scriptApp.compile, style, statik, nodeModulesCopy)
	.then(() => build({
		targets: Platform.WINDOWS.createTarget(),
		config: {
			appId: "chirivulpes.magictranslator",
			productName: "MagicTranslator",
			copyright: "Copyright © 2022 Chiri Vulpes",
			directories: {
				app: "out",
			},
			win: {
				target: "portable",
			},
			includeSubNodeModules: true,
		},
	}))
	.create();
