import chalk from "chalk";
import type { ChildProcess } from "child_process";
import { exec } from "child_process";
import * as path from "path";
import Bound from "./Bound";
import { getElapsedString, getTimeString } from "./Util";

export default class TypescriptWatch {
	private onDataHandler: (data: string) => any;
	private onCompleteHandler: () => any;
	private initialized: (() => void) | true | undefined;
	private readonly inDir: string;
	private readonly outDir: string;
	private declaration: string | undefined;
	private task: ChildProcess;

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

	@Bound
	public async compile () {
		await this.watch().waitForInitial();
		this.task.kill();
	}

	public watch () {
		const ocwd = process.cwd();
		process.chdir(this.inDir);
		const declaration = this.declaration ? `--declaration --declarationDir "${this.declaration}"` : "";
		const command = `npx tsc --outDir "${this.outDir}" --pretty --watch ${declaration}`;
		this.task = exec(command);
		process.chdir(ocwd);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		this.task.stderr!.on("data", data => process.stderr.write(data));

		let start: number;
		this.task.stdout!.on("data", data => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
			const dataString = data.toString() as string;
			if (this.onDataHandler && this.onDataHandler(dataString) === false)
				return;

			if (/\bincremental compilation|in watch mode\b/.test(dataString))
				start = Date.now();

			if (/Watching for file changes./.test(dataString) && this.initialized) {
				if (typeof this.initialized === "function") {
					this.initialized();
					this.initialized = true;

				} else {
					this.onCompleteHandler();
				}
			}

			process.stdout.write(handleTscOut(start, dataString, `${path.relative(ocwd, this.inDir).replace(/\\/g, "/")}/`));
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
		.replace(/\. Watching for file changes\.(\r\n)*/, ` after ${getElapsedString(startTime)}\r\n`)
		.replace(/(incremental compilation...|in watch mode...)\r\n/g, "$1")
		.replace(/( TS\d{4}: [^\r\n]*?\r\n)\r\n/g, "$1")
		.replace(/(~+[^\r\n]*?\r\n)\r\n\r\n/g, "$1")
		// eslint-disable-next-line no-control-regex
		.replace(/(?=\[30;47m(\d+| +)\u001b\[0m)/g, "\t")
		// eslint-disable-next-line no-control-regex
		.replace(/\[\u001b\[90m\d{1,2}:\d{2}:\d{2} [AP]M\u001b\[0m\]/g, `[${getTimeString()}]`);

	if (prefix) {
		// eslint-disable-next-line no-control-regex
		data = data.replace(/(\u001b\[96m.*?\u001b\[0m:\u001b\[93m)/g, chalk.cyan(`${prefix}$1`));
	}

	return data;
}
