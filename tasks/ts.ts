/* eslint-disable no-control-regex */
import ansicolor from "ansicolor";
import Electron from "./utility/Electron";
import Env from "./utility/Env";
import Log from "./utility/Log";
import Task from "./utility/Task";
import type { Stopwatch } from "./utility/Time";
import { elapsed, stopwatch } from "./utility/Time";

const options = ["--inlineSourceMap", "--inlineSources", "--incremental"];

class Reformatter {
	private lastStart?: Stopwatch;

	public constructor (public readonly root = "") { }

	public out = (data: string | Buffer) => {
		data = data.toString("utf8");

		data = data
			.replace(/\[\x1b\[90m\d{1,2}:\d{2}:\d{2}[ \xa0\u202f][AP]M\x1b\[0m\][ \xa0\u202f]/gi, "") // remove time
			.replace(/(\x1b\[96m)(.*?\x1b\[0m:\x1b\[93m)/g, `$1${this.root}/$2`); // longer file paths

		const lines = data.split("\n");
		for (let line of lines) {
			if (line.trim().length === 0) {
				// ignore boring lines
				continue;
			}

			if (line.startsWith("> ")) {
				// ignore "> tsc --build --watch --pretty --preserveWatchOutput" line
				continue;
			}

			if (line.includes("Starting compilation in watch mode...")) {
				this.lastStart = stopwatch();
			} else if (line.includes("Starting incremental compilation...")) {
				if (this.lastStart) {
					// ignore duplicate "starting incremental compilation" line
					continue;
				}

				this.lastStart = stopwatch();
			}

			if (!Env.NO_COLOURIZE_ERRORS) {
				line = line
					.replace(/(?<!\d)0 errors/, ansicolor.lightGreen("0 errors"))
					.replace(/(?<!\d)(?!0)(\d+) errors/, ansicolor.lightRed("$1 errors"));
			}

			if (line.includes(". Watching for file changes.")) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				Electron.restart(null as any); // uwu
				if (!Env.NO_LOG_TSC_DURATION) {
					line = line.replace(". Watching for file changes.", ` after ${ansicolor.magenta(elapsed(this.lastStart!.elapsed))}`);
					delete this.lastStart;
				}
			}

			Log.info(line);
		}

	};
}

function tscli (cwd: string, ...args: string[]) {
	return Task.cli({ cwd, stdout: new Reformatter(cwd).out }, "tsc", ...args);
}

export default Task("ts", task => task.series(
	task.parallel(
		() => tscli("script/window", "--pretty", ...options),
		() => tscli("script/app", "--pretty", ...options),
	)));

export const tsWatch = Task("ts (watch)", task => task.parallel(
	() => tscli("script/window", "--watch", "--preserveWatchOutput", "--pretty", ...options),
	() => tscli("script/app", "--watch", "--preserveWatchOutput", "--pretty", ...options),
));
