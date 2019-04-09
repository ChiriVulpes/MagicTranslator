import FileSystem from "util/FileSystem";

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

export default class Characters {

	public constructor (private readonly root: string) { }

	public async load (): Promise<CharactersData> {
		const jsonData = await FileSystem.priority.readFile(`${this.getCharactersPath()}/characters.json`, "utf8")
			.catch(() => { });

		const charactersData: Partial<CharactersData> = JSON.parse(jsonData || "{}");

		return {
			characterId: charactersData.characterId || 0,
			characters: charactersData.characters || [],
		};
	}

	public async save (data: CharactersData) {
		await FileSystem.writeFile(`${this.getCharactersPath()}/characters.json`, JSON.stringify(data, undefined, "\t"));
	}

	public getCharactersPath () {
		return `${this.root}/character`;
	}
}
