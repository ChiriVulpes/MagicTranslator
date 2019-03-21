import * as proc from "child_process";
import * as electron from "electron";
import * as path from "path";
import { nameFunction, stringifyCall } from "./Util";

module Electron {
	let p = ".";
	let child: proc.ChildProcess;
	let _args: string[];

	export function start (dir?: string, ...args: string[]) {
		p = path.resolve(process.cwd(), dir || p);
		_args = [...args, p];
		return nameFunction(stringifyCall("Electron.start", dir || "."), spawn);
	}

	export async function restart () {
		await spawn();
	}
	nameFunction(stringifyCall("Electron.restart", p), restart);

	async function spawn () {
		// if (child) child.kill();

		// brutally murder any electron.exe processes lol
		// pls forgive, nothing else worked
		try {
			proc.execSync("taskkill /f /im electron.exe", {
				stdio: ["ignore", "ignore", "ignore"],
			});
		} catch (err) { }

		child = proc.spawn(electron as any, _args, { cwd: p });

		child.on("error", err => console.error(err));

		child.stdout!.on("data", data => process.stdout.write(data.toString().trim()));
		child.stderr!.on("data", data => process.stdout.write(data.toString().trim()));
	}
}

export default Electron;
