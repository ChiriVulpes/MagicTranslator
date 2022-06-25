import type { PlatformCLIPaths } from "Options";
import { getValidPath } from "Options";
import ChildProcess from "util/ChildProcess";
import Objects from "util/Objects";
import Path from "util/string/Path";

export default abstract class Captor {

	public static get (path: string) {
		return this.getCaptor(path, ...this.getCaptorClasses());
	}

	public static getCaptorPlatformPaths () {
		return this.getCaptorClasses().stream()
			.map(cls => new cls("").getValidPaths())
			.splat(Objects.deepMerge);
	}

	private static getCaptorClasses (): (new (path: string) => Captor)[] {
		return [Capture2TextCaptor, TesseractCaptor];
	}

	private static async getCaptor (path: string, ...captors: (new (path: string) => Captor)[]) {
		for (const captorClass of captors) {
			const captor = new captorClass(path);
			if (await captor.isValid())
				return captor;
		}

		return undefined;
	}

	public constructor (protected readonly path: string) { }

	public async capture (captureImagePath: string, vertical: boolean) {
		const [out] = await ChildProcess.exec(this.getCaptureExecPath(captureImagePath, vertical));
		return out.toString("utf8").trim();
	}

	protected abstract getValidPaths (): PlatformCLIPaths;
	protected abstract getCaptureExecPath (captureImagePath: string, vertical: boolean): string;

	private async isValid () {
		return getValidPath(Path.dirname(this.path), this.getValidPaths());
	}
}


////////////////////////////////////
// Captors
//

export class Capture2TextCaptor extends Captor {
	public getValidPaths () {
		return {
			win32: ["Capture2Text_CLI.exe"],
		};
	}
	public getCaptureExecPath (captureImagePath: string, vertical: boolean) {
		return `"${this.path}" --language Japanese --image "${captureImagePath}" --line-breaks${vertical ? " --vertical" : ""}`;
	}
}

export class TesseractCaptor extends Captor {
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
	public getCaptureExecPath (captureImagePath: string, vertical: boolean) {
		return `"${this.path}" "${captureImagePath}" stdout -l jpn+jpn_vert --psm ${vertical ? "5" : "6"}`;
	}
}
