import core from "@actions/core";
import { build, Platform } from "electron-builder";
import gulpSass from "gulp-sass";
import fs from "mz/fs";
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
	.then(watchScriptWindow, watchScriptApp, style, statik, nodeModules, version)
	.then(Electron.start("out"))
	.then(
		watch("style/**/*.scss", new Series(style).then(Electron.restart)),
		watch(["static/**/*", "!static/node_modules/**/*"], new Series(statik).then(Electron.restart)))
	.create();

interface VersionObject {
	version: string;
	commit: string;
}

let versionObject: VersionObject | undefined;
async function version () {
	const FETCH_HEAD = (await fs.readFile(".git/FETCH_HEAD", "utf8"))?.slice(0, 7);
	if (!FETCH_HEAD)
		throw new Error("Could not find commit hash");

	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	const packageVersion = JSON.parse(await fs.readFile("static/package.json", "utf8") ?? "{}").version as string | undefined;
	if (!packageVersion)
		throw new Error("Could not find package version");

	await fs.writeFile("out/version", JSON.stringify(versionObject = {
		version: packageVersion,
		commit: FETCH_HEAD,
	}));

	core.setOutput("version", versionObject.version);
	core.setOutput("name", `${versionObject.version}-${versionObject.commit}`);
}

new Task("build", remove(["dist", "out"]))
	.then(scriptWindow.compile, scriptApp.compile, style, statik, nodeModulesCopy, version)
	.then(() => build({
		targets: new Map([Platform.WINDOWS, Platform.LINUX]
			.flatMap(platform => [...platform.createTarget().entries()])),
		config: {
			appId: "chirivulpes.magictranslator",
			productName: "MagicTranslator",
			copyright: `Copyright © ${new Date().getFullYear()} Chiri Vulpes`,
			directories: {
				app: "out",
			},
			win: {
				target: ["portable", "zip"],
			},
			linux: {
				target: ["AppImage", "zip"],
			},
			includeSubNodeModules: true,
			buildVersion: `${versionObject!.version}-${versionObject!.commit}`,
		},
	}))
	.create();
