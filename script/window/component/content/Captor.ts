import ChildProcess from "util/ChildProcess";

export interface Captor {
	capture (captureImagePath: string, vertical: boolean): Promise<string>
}

export class Capture2TextCaptor implements Captor {
	public constructor (private readonly capture2TextPath: string) {

	}

	public async capture (captureImagePath: string, vertical: boolean) {
		const [out] = await ChildProcess.exec(`"${this.capture2TextPath}" --language Japanese --image "${captureImagePath}" --line-breaks${vertical ? " --vertical" : ""}`);
		return out.toString("utf8").trim()
	}
}

export class TesseractCaptor implements Captor {
	public constructor (private readonly tesseractPath: string) {

	}

	public async capture (captureImagePath: string, vertical: boolean) {
		const [out] = await ChildProcess.exec(`"${this.tesseractPath}" "${captureImagePath}" stdout -l jpn+jpn_vert`);
		return out.toString("utf8").trim()
	}
}