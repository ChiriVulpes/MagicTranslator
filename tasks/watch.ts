import chokidar from "chokidar";
import fs from "fs/promises";
import path from "path";
import clean from "./clean";
import sass from "./sass";
import _static from "./static";
import ts, { tsWatch } from "./ts";
import Electron from "./utility/Electron";
import Hash from "./utility/Hash";
import Task from "./utility/Task";

const resass = Task("resass", task => task.series(sass, Electron.restart));
const restatic = Task("restatic", task => task.series(_static, Electron.restart));

export default Task("watch", task => task.series(
	clean,
	ts,
	sass,
	_static,
	Task("link node modules", async () =>
		fs.symlink(path.resolve("script/window/node_modules"), path.resolve("out/node_modules"), "junction")),
	Electron.start("out"),

	Task("watch", async () => {
		chokidar.watch(["style/**/*.scss"], { ignoreInitial: true })
			.on("all", () =>
				task.debounce(resass));

		chokidar.watch(["static/**/*"], { ignoreInitial: true })
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			.on("all", async (event, path) => true
				&& (await Hash.fileChanged(path))
				&& task.debounce(restatic));

		await task.run(tsWatch);
	}),
));
