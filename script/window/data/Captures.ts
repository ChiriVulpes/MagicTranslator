import { BasicCharacter } from "data/Characters";
import MediaRoots from "data/MediaRoots";
import FileSystem from "util/FileSystem";

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
	public async load (root: string, volume: number, chapter: number, page: number): Promise<TranslationData> {
		const jsonData = await FileSystem.readFile(`${this.getCapturePagePath(root, volume, chapter, page)}.json`, "utf8")
			.catch(() => { });

		const translationData: Partial<TranslationData> = JSON.parse(jsonData || "{}");

		return {
			captureId: translationData.captureId || 0,
			captures: translationData.captures || [],
		};
	}

	public async save (root: string, volume: number, chapter: number, page: number, data: TranslationData) {
		const capturePagePath = this.getCapturePagePath(root, volume, chapter, page);
		await FileSystem.mkdir(path.dirname(capturePagePath));
		await FileSystem.writeFile(`${capturePagePath}.json`, JSON.stringify(data, undefined, "\t"));
	}

	public getCapturePagePath (root: string, volume: number, chapter: number, page: number) {
		const [volumeString, chapterString, pageString] = MediaRoots.get(root)!.volumes.getPaths(volume, chapter, page);
		return `${root}/${volumeString}/${chapterString}/capture/${pageString.slice(0, -4)}`;
	}
}

const Captures = new CapturesImpl();

export default Captures;
