import type { BasicCharacter } from "data/Characters";
import Serializable, { Serialized } from "data/Serialized";

export interface CaptureData {
	version?: number;
	id?: number;
	position?: { x: number; y: number };
	size?: { x: number; y: number };
	text: string;
	translation: string;
	glossNotes?: [string, string][];
	notes: [string, string][];
	character?: number | BasicCharacter;
}

export interface TranslationData {
	captureId: number;
	captures: CaptureData[];
}

export default class Captures extends Serializable {

	@Serialized public captureId = 0;
	@Serialized public captures: CaptureData[] = [];
	@Serialized public rawSize?: { x: number; y: number }

	public constructor (path: string) {
		super(`${path}.json`);
	}

	public getMissingTranslations () {
		return this.captures.stream()
			.filter(capture => !capture.translation);
	}

	protected override shouldSaveFileExist () {
		return !!this.captures.length;
	}
}
