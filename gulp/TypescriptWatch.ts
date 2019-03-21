import chalk from "chalk";
import { exec } from "child_process";
import * as path from "path";

export default class TypescriptWatch {
	private onDataHandler: (data: string) => any;
	private onCompleteHandler: () => any;
	private initialized: (() => void) | true | undefined;
	private readonly inDir: string;
	private readonly outDir: string;
	private declaration: string | undefined;

	public constructor (dir: string, outDir: string) {
		this.inDir = path.resolve(dir);
		this.outDir = path.resolve(outDir);
	}

	public onData (handler: (data: string) => boolean | undefined | void) {
		this.onDataHandler = handler;
		return this;
	}

	public onComplete (handler: () => any) {
		this.onCompleteHandler = handler;
		return this;
	}

	public setDeclaration (dir: string) {
		this.declaration = path.resolve(dir);
		return this;
	}

	public watch () {
		const ocwd = process.cwd();
		process.chdir(this.inDir);
		const declaration = this.declaration ? `--declaration --declarationDir ${this.declaration}` : "";
		const task = exec(`npx tsc --outDir ${this.outDir} --pretty --watch ${declaration}`);
		process.chdir(ocwd);

		task.stderr!.on("data", data => process.stderr.write(data));

		let start: number;
		task.stdout!.on("data", data => {
			if (this.onDataHandler && this.onDataHandler(data.toString()) === false)
				return;

			if (/\bincremental compilation|in watch mode\b/.test(data.toString()))
				start = Date.now();

			if (/Watching for file changes./.test(data.toString()) && this.initialized) {
				if (typeof this.initialized === "function") {
					this.initialized();
					this.initialized = true;

				} else {
					this.onCompleteHandler();
				}
			}

			process.stdout.write(handleTscOut(start, data, `${path.relative(ocwd, this.inDir).replace(/\\/g, "/")}/`));
		});

		return this;
	}

	public async waitForInitial () {
		return new Promise<void>(resolve => {
			if (this.initialized === true) return resolve();

			this.initialized = resolve;
		});
	}
}

function handleTscOut (startTime: number, data: string | Buffer, prefix?: string) {
	data = data.toString()
		.replace("\u001bc", "")
		.replace(/. Watching for file changes.\r\n/, ` after ${getTimeString(startTime)}`)
		.replace(/(incremental compilation...|in watch mode...)\r\n/g, "$1")
		.replace(/( TS\d{4}: [^\r\n]*?\r\n)\r\n/g, "$1")
		.replace(/(~+[^\r\n]*?\r\n)\r\n\r\n/g, "$1")
		.replace(/(?=\[30;47m(\d+| +)\u001b\[0m)/g, "\t");

	if (prefix) {
		data = data.replace(/(\u001b\[96m.*?\u001b\[0m:\u001b\[93m)/g, chalk.cyan(`${prefix}$1`));
	}

	return data;
}

function getTimeString (start: number) {
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
