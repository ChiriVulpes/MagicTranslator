import gulpSass from "gulp-sass";
import Electron from "./gulp/Electron";
import Task, { Pipe, remove, Series, symlink, watch } from "./gulp/Task";
import TypescriptWatch from "./gulp/TypescriptWatch";

////////////////////////////////////
// Scripts
//

const windowScript = new TypescriptWatch("script/window", "out/script")
	.setDeclaration("out/defs")
	.onComplete(Electron.restart);

async function scriptWindow () {
	return windowScript.watch().waitForInitial();
}

const appScript = new TypescriptWatch("script/app", "out")
	.onComplete(Electron.restart);

async function scriptApp () {
	return appScript.watch().waitForInitial();
}

const style = new Pipe("style", "style/**/*.scss")
	.pipe(gulpSass)
	.pipe("out/style");

const statik = new Pipe("static", ["static/**/*", "!static/node_modules/**/*"])
	.pipe("out");

const nodeModules = new Pipe("node-modules", "script/window/node_modules")
	.pipe(symlink("out"));

////////////////////////////////////
// Tasks
//

new Task("watch", remove("out"))
	.then(scriptWindow, scriptApp, style, statik, nodeModules)
	.then(Electron.start("out"))
	.then(
		watch("style/**/*.scss", new Series(style).then(Electron.restart)),
		watch(["static/**/*", "!static/node_modules/**/*"], new Series(statik).then(Electron.restart)))
	.create();

/*
new Task("build", remove("build"))
	.then(script, style, statik)
	.then(forge.make("build"))
	.create();
*/
