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

export class CharactersImpl {
	public async load (): Promise<CharactersData> {
		const jsonData = await fs.readFile(`${this.getCharactersPath()}/characters.json`, "utf8")
			.catch(() => { });

		const charactersData: Partial<CharactersData> = JSON.parse(jsonData || "{}");

		return {
			characterId: charactersData.characterId || 0,
			characters: charactersData.characters || [],
		};
	}

	public async save (data: CharactersData) {
		await fs.writeFile(`${this.getCharactersPath()}/characters.json`, JSON.stringify(data));
	}

	public getCharactersPath () {
		return `${options.root}/character`;
	}
}

const Characters = new CharactersImpl();

export default Characters;
