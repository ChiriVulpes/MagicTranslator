import { BasicCharacter } from "data/Characters";
import { TriggerHandler, Triggers } from "util/FieldSetTriggers";
import FileSystem from "util/FileSystem";
import { Objects } from "util/Objects";

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

@TriggerHandler("save")
export default class Captures {

	@Triggers public captureId = 0;
	@Triggers public captures: CaptureData[] = [];

	private saving?: Promise<void>;

	public constructor (private readonly path: string) { }

	public async load () {
		const translationData = await this.readTranslationData();

		this.captureId = translationData.captureId || 0;
		this.captures = translationData.captures || [];

		return this;
	}

	public async save () {
		await this.saving;
		this.saving = this.saveInternal();
		await this.saving;
		delete this.saving;
	}

	public getMissingTranslations () {
		return this.captures.stream()
			.filter(capture => !capture.translation);
	}

	private async saveInternal () {
		if (!this.captures.length) return FileSystem.unlink(`${this.path}.json`);

		await FileSystem.mkdir(path.dirname(this.path));

		const translationData = await this.readTranslationData();
		const newTranslationData = {
			captureId: this.captureId,
			captures: this.captures,
		};

		if (Objects.deepEquals(translationData, newTranslationData)) return;

		await FileSystem.writeFile(`${this.path}.json`, JSON.stringify(newTranslationData, undefined, "\t"));
	}

	private async readTranslationData (): Promise<Partial<TranslationData>> {
		const jsonData = await FileSystem.readFile(`${this.path}.json`, "utf8")
			.catch(() => { });

		return JSON.parse(jsonData || "{}");
	}
}
