import Serializable, { Serialized } from "data/Serialized";
import Enums from "util/Enums";
import Translation from "util/string/Translation";

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

	public constructor (root: string) {
		super(`${root}/characters.json`);
	}

	public get (id: number) {
		return this.characters.stream()
			.first(character => character.id === id);
	}

	public findByName (name: string) {
		const basicCharacter = Enums.values(BasicCharacter)
			.filter(character => new Translation(`character-${character}`).get().toLowerCase() === name.toLowerCase())
			.first();

		if (basicCharacter !== undefined) return basicCharacter;

		return this.characters.stream()
			.first(character => character.name === name, () => ({}))
			.id;
	}

	@Bound public getName (character: number | BasicCharacter | CharacterData | undefined) {
		if (typeof character === "number") character = this.get(character);
		return !character ? "" : typeof character === "object" ? character.name : new Translation(`character-${character.toLowerCase()}`).get();
	}

	public getId (character?: number | BasicCharacter | CharacterData): number | BasicCharacter;
	public getId (character?: number | BasicCharacter | CharacterData) {
		if (typeof character === "string") return character;
		if (typeof character === "number") character = this.get(character);
		if (!character) return BasicCharacter.Unknown;
		return character.id;
	}
}
