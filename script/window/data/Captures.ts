import { BasicCharacter } from "data/Characters";
import Volumes from "data/Volumes";

export interface CaptureData {
	id?: number;
	position?: { x: number; y: number };
	size?: { x: number; y: number };
	text: string;
	translation: string;
	notes: [string, string][];
	character?: number | BasicCharacter;
}

export interface TranslationData {
	captureId: number;
	captures: CaptureData[];
}

export class CapturesImpl {
	public async load (volume: number, chapter: number, page: number): Promise<TranslationData> {
		const jsonData = await fs.readFile(`${this.getCapturePagePath(volume, chapter, page)}.json`, "utf8")
			.catch(() => { });

		const translationData: Partial<TranslationData> = JSON.parse(jsonData || "{}");

		return {
			captureId: translationData.captureId || 0,
			captures: translationData.captures || [],
		};
	}

	public async save (volume: number, chapter: number, page: number, data: TranslationData) {
		const capturePagePath = this.getCapturePagePath(volume, chapter, page);
		await fs.mkdir(path.dirname(capturePagePath));
		await fs.writeFile(`${capturePagePath}.json`, JSON.stringify(data, undefined, "\t"));
	}

	public getCapturePagePath (volume: number, chapter: number, page: number) {
		const [volumeString, chapterString, pageString] = Volumes.getPaths(volume, chapter, page);
		return `${options.root}/${volumeString}/${chapterString}/capture/${pageString.slice(0, -4)}`;
	}
}

const Captures = new CapturesImpl();

export default Captures;
