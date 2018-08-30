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
