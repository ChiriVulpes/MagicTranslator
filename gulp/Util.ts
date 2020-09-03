import chalk from "chalk";

export async function sleep (ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function nameFunction<F extends Function> (name: string, fn: F) {
	(fn as any).displayName = name;
	return fn;
}

export function stringifyCall (name: string, ...args: (string | string[])[]) {
	const simpleArgs = new Array<string>().concat(...args.map(arg => Array.isArray(arg) ? arg : [arg]));
	return `${name}(` + simpleArgs.map(w => chalk.green(w)).join(chalk.cyan(", ")) + chalk.cyan(")");
}

export function getTimeString () {
	return chalk.grey(new Date().toLocaleTimeString(undefined, { hour12: false }));
}

export function getElapsedString (start: number) {
	const time = Date.now() - start;
	let timeString;

	if (time >= 1000) {
		timeString = `${(time / 1000).toFixed(2).replace(/0+$/, "")} s`;

	} else if (time >= 100) {
		timeString = `${(time / 100).toFixed(0)} ms`;

	} else {
		timeString = `${time} μs`;
	}

	return chalk.magenta(timeString);
}

