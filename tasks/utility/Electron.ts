import ansicolor from "ansicolor";
import proc from "child_process";
import electron from "electron";
import path from "path";
import Task from "./Task";

function stringifyCall (name: string, ...args: (string | string[])[]) {
	const simpleArgs = new Array<string>().concat(...args.map(arg => Array.isArray(arg) ? arg : [arg]));
	return `${ansicolor.cyan(name)}(` + simpleArgs.map(w => ansicolor.lightGreen(w)).join(ansicolor.cyan(", ")) + ansicolor.cyan(")");
}

namespace Electron {
	let p = ".";
	let child: proc.ChildProcess;
	let _args: string[];

	export function start (dir?: string, ...args: string[]) {
		p = path.resolve(process.cwd(), dir || p);
		_args = [...args, p];
		return Task(stringifyCall("Electron.start", dir || "."), () => spawn());
	}

	export const restart = Task(stringifyCall("Electron.restart", p), () => spawn());

	// eslint-disable-next-line no-inner-declarations
	function spawn (cb?: () => void) {
		// if (child) child.kill() ;

		// brutally murder any electron.exe processes lol
		// pls forgive, nothing else worked
		try {
			proc.execSync("taskkill /f /im electron.exe", {
				stdio: ["ignore", "ignore", "ignore"],
			});
		} catch (err) { }

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		child = proc.spawn(electron as any, _args, { cwd: p });

		child.on("error", err => console.error(err));

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		child.stdout!.on("data", data => process.stdout.write(data.toString().trim()));
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		child.stderr!.on("data", data => process.stdout.write(data.toString().trim()));

		cb?.();
	}
}

export default Electron;
