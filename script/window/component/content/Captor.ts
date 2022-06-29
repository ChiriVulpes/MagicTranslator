import type { PlatformCLIPaths } from "Options";
import { getValidPath } from "Options";
import ChildProcess from "util/ChildProcess";
import Objects from "util/Objects";
import Path from "util/string/Path";
import FileSystem from "util/FileSystem";

export default abstract class Captor {

	public static get (path: string) {
		return this.getCaptor(path, ...this.getCaptorClasses());
	}

	public static getCaptorPlatformPaths () {
		return this.getCaptorClasses().stream()
			.map(cls => new cls("").getValidPaths())
			.splat(Objects.deepMerge);
	}

	private static getCaptorClasses (): (new (path: string) => ExecutableBasedCaptor)[] {
		return [Capture2TextCaptor, TesseractCaptor];
	}

	private static async getCaptor (path: string, ...captors: (new (path: string) => ExecutableBasedCaptor)[]) {
		for (const captorClass of captors) {
			const captor = new captorClass(path);
			if (await captor.isValid())
				return captor;
		}

		return undefined;
	}

	public abstract capture (captureImagePath: string, vertical: boolean) : Promise<string>;
	public abstract isValid () : Promise<boolean>;
}

export abstract class ExecutableBasedCaptor extends Captor {

	public constructor (protected readonly path: string) {
		super();
	}

	public async capture (captureImagePath: string, vertical: boolean) {
		const [out] = await ChildProcess.exec(this.getCaptureExecPath(captureImagePath, vertical));
		return out.toString("utf8").trim();
	}

	public abstract getValidPaths (): PlatformCLIPaths;
	protected abstract getCaptureExecPath (captureImagePath: string, vertical: boolean): string;

	public async isValid () : Promise<boolean> {
		return !!(await getValidPath(Path.dirname(this.path), this.getValidPaths()));
	}
}


////////////////////////////////////
// Captors
//

export class OCRAggregatorServerCaptor extends Captor {
	public constructor (private readonly baseAddress: URL) {
		super();
	}

	public async capture(captureImagePath: string, vertical: boolean): Promise<string> {
		const file = await FileSystem.readFile(captureImagePath);
		const formData = new FormData();
		formData.append('input_image', new Blob([file.buffer]));

		const result = await fetch(new URL('/ocr', this.baseAddress).toString(), {
			method: "POST",
			body: formData
		});
		const json = await result.json();
		const text = json as string;

		return text;
	}
	public async isValid(): Promise<boolean> {
		try {
			const result = await fetch(new URL('/ready', this.baseAddress).toString());
			const json = await result.json() as { ready: boolean };
			return json.ready;
		}
		catch(err) {
			return false;
		}
	}
}

export class Capture2TextCaptor extends ExecutableBasedCaptor {
	public getValidPaths () {
		return {
			win32: ["Capture2Text_CLI.exe"],
		};
	}
	 public getCaptureExecPath (captureImagePath: string, vertical: boolean): string {
		return `"${this.path}" --language Japanese --image "${captureImagePath}" --line-breaks${vertical ? " --vertical" : ""}`;
	}
}

export class TesseractCaptor extends ExecutableBasedCaptor {
	public getValidPaths () {
		return {
			win32: ["tesseract.exe"],
			linux: ["tesseract"],
			darwin: ["tesseract"],
			aix: ["tesseract"],
			freebsd: ["tesseract"],
			openbsd: ["tesseract"],
			sunos: ["tesseract"],
		};
	}

	public getCaptureExecPath (captureImagePath: string, vertical: boolean): string {
		return `"${this.path}" "${captureImagePath}" stdout -l jpn+jpn_vert --psm ${vertical ? "5" : "6"}`;
	}
}
