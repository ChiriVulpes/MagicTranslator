import * as Gulp from "gulp";
import { Done } from "./Task";
import { nameFunction, stringifyCall } from "./Util";
const runElectron = require("gulp-run-electron") as IRunElectron;

interface IRunElectron {
	(args?: string[], opts?: { cwd?: string }): NodeJS.ReadWriteStream;
	rerun (done: Done): void;
}

module Electron {
	let p = ".";
	export function start (path?: string, ...args: string[]) {
		p = path || p;
		return nameFunction(stringifyCall("Electron.start", p), () => Gulp.src(p).pipe(runElectron(args, { cwd: p })));
	}

	export async function restart () {
		return new Promise<void>(resolve => runElectron.rerun(resolve));
	}
	nameFunction(stringifyCall("Electron.restart", p), restart);
}

export default Electron;
