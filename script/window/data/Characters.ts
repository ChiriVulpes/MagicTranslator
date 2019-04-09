import Serializable, { Serialized } from "data/Serialized";

export interface CharacterData {
	id: number;
	name: string;
}

export interface CharactersData {
	characterId: number;
	characters: CharacterData[];
}

export enum BasicCharacter {
	Sfx = "sfx",
	Narrator = "narrator",
	ChapterTitle = "chapter-title",
	Unknown = "unknown",
}

export default class Characters extends Serializable {

	@Serialized public characterId = 0;
	@Serialized public characters: CharacterData[] = [];

	public constructor (private readonly root: string) {
		super(`${root}/character/characters.json`);
	}

	public getPath () {
		return `${this.root}/character`;
	}
}
