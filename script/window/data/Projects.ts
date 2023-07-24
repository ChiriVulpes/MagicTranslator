import Captures from "data/Captures";
import Characters from "data/Characters";
import Serializable, { Serialized } from "data/Serialized";
import Thumbs from "data/Thumbs";
import { tuple } from "util/Arrays";
import FileSystem from "util/FileSystem";
import IndexedMap from "util/Map";
import { interpolate } from "util/string/Interpolator";
import Path from "util/string/Path";
import { mask, pad } from "util/string/String";

class Projects extends Map<string, Project> {

	public current?: Project;

	public override keys () {
		return options.projectFolders.values();
	}

	public async load () {
		(await this.getProjects())
			.toMap(this);
	}

	public async addProject (root: string) {
		this.set(root, await new Project(root).load());
	}

	private async getProjects () {
		return options.projectFolders.stream()
			.map(async root => tuple(root, await new Project(root).load()))
			.rest();
	}
}

export default new Projects;

export interface Page {
	filename: string;
	captures: Captures;
}

function stringTuple<A extends string[]> (...args: A): A { return args; }

export const pathSegments = stringTuple("volume", "chapter", "page");
export type PagePathSegment = (typeof pathSegments)[number];
export namespace PagePathSegment {
	export function is (value: unknown): value is PagePathSegment {
		return pathSegments.includes(value as PagePathSegment);
	}
}

export const pathTypes = stringTuple("raw", "translated", "capture", "save");
export type PagePathType = (typeof pathTypes)[number];
export namespace PagePathType {
	export function is (value: unknown): value is PagePathType {
		return pathTypes.includes(value as PagePathType);
	}
}

export type ProjectStructure = typeof defaultProjectStructure;

const defaultProjectStructure = {
	volume: "vol##",
	chapter: "ch###",
	page: "###",
	character: "character",
	thumb: ".magictranslator/thumb",
	raw: "{volume}/{chapter}/raw/{page}.png",
	translated: "{volume}/{chapter}/translated/{page}.png",
	capture: "{volume}/{chapter}/capture/{page}",
	save: "{volume}/{chapter}/save/{page}",
};

export class Project extends Serializable {

	public characters: Characters;
	public thumbs: Thumbs;

	@Serialized public name?: string;
	@Serialized public externalEditorCLIPath?: string;
	@Serialized public structure: ProjectStructure = { ...defaultProjectStructure };

	public volumes: IndexedMap<string, IndexedMap<string, Page[]>>;

	public constructor (public readonly root: string) {
		super(`${root}/metadata.json`);
	}

	public getDisplayName () {
		return this.name || Path.basename(this.root);
	}

	public override async load () {
		await super.load();
		this.canSave = false;

		for (const key of Stream.keys(defaultProjectStructure)) {
			if (!(key in this.structure)) {
				this.structure[key] = defaultProjectStructure[key];
			}
		}

		this.canSave = true;

		this.characters = await new Characters(this.getPath("character")).load();
		this.thumbs = await new Thumbs(Path.join(this.root, this.structure.thumb)).load();
		this.volumes = await this.getVolumes();
		return this;
	}

	public getPath (pathType: "character", character?: number): string;
	public getPath (pathType: PagePathType, volume: number, chapter: number, page: number): string;
	public getPath (pathType: PagePathType, volume: string, chapter: string, page: string): string;
	public getPath (pathType: PagePathType | "character" | "thumb", volume?: string | number, chapter?: string | number, page?: string | number) {
		const pathTypeSetting = this.structure[pathType];
		switch (pathType) {
			case "character": {
				const character = volume;
				const charactersPath = Path.join(this.root, pathTypeSetting);
				return character === undefined ? charactersPath : Path.join(charactersPath, `${pad(character, 3)}.png`);
			}
			default: {
				[volume, chapter, page] = this.getSegmentNumbers(volume as number, chapter as number, page as number);
				return this.interpolate(pathTypeSetting, volume, chapter, page);
			}
		}
	}

	public getPage (volume: number, chapter: number, page: number) {
		return this.volumes.getByIndex(volume)!.getByIndex(chapter)![page];
	}

	public getPathSegments (volume: number): [string];
	public getPathSegments (volume: number, chapter: number): [string, string];
	public getPathSegments (volume: number, chapter: number, page: number): [string, string, string];
	public getPathSegments (volume: number, chapter: number, page?: number): [string, string?, string?];
	public getPathSegments (volume: number, chapter?: number, page?: number): [string?, string?, string?];
	public getPathSegments (volume: number, chapter?: number, page?: number): [string?, string?, string?] {
		const volumeString = this.volumes.getKey(volume);
		if (chapter === undefined) return [volumeString];

		const chapters = this.volumes.get(volumeString)!;
		const chapterString = chapters.getKey(chapter);
		if (page === undefined) return [volumeString, chapterString];

		const pages = chapters.get(chapterString)!;
		return [volumeString, chapterString, pages[page] && pages[page].filename];
	}

	public getSegmentNumbers (volume: number): [number];
	public getSegmentNumbers (volume: number, chapter: number): [number, number];
	public getSegmentNumbers (volume: number, chapter: number, page: number): [number, number, number];
	public getSegmentNumbers (volume: number, chapter: number, page?: number): [number, number, number?];
	public getSegmentNumbers (volume: number, chapter?: number, page?: number): [number, number?, number?];
	public getSegmentNumbers (volume: string): [number];
	public getSegmentNumbers (volume: string, chapter: string): [number, number];
	public getSegmentNumbers (volume: string, chapter: string, page: string): [number, number, number];
	public getSegmentNumbers (volume: string, chapter: string, page?: string): [number, number, number?];
	public getSegmentNumbers (volume: string, chapter?: string, page?: string): [number, number?, number?];
	public getSegmentNumbers (volume: number | string, chapter?: number | string, page?: number | string): [number?, number?, number?] {
		if (typeof volume === "number") {
			[volume, chapter, page] = this.getPathSegments(volume, chapter as number, page as number);
		}

		return [
			parseFloat(mask(this.getBaseFileName("raw", "volume", "~").replace(/[^#]/g, " "), volume || "")),
			parseFloat(mask(this.getBaseFileName("raw", "chapter", "~").replace("#", "###").replace(/[^#]/g, " "), chapter as string || "")),
			parseFloat(mask(this.getBaseFileName("raw", "page", "~").replace(/[^#]/g, " "), page as string || "")),
		];
	}

	public getVolumeDirectory (type: keyof ProjectStructure, volume?: string | number) {
		const directory = this.directories(type)[volume === undefined ? "volumes" : "volume"];
		return this.interpolate(directory, volume);
	}

	public getChapterDirectory (type: keyof ProjectStructure, volume: string | number, chapter?: string | number) {
		const directory = this.directories(type)[chapter === undefined ? "chapters" : "chapter"];
		return this.interpolate(directory, volume, chapter);
	}

	public getPageDirectory (type: keyof ProjectStructure, volume: string | number, chapter: string | number, page?: string | number) {
		const directory = this.directories(type)[page === undefined ? "pages" : "page"];
		return this.interpolate(directory, volume, chapter, page);
	}

	private directories (type: keyof ProjectStructure) {
		const [page, pages, chapter, chapters, volume, volumes] = this.structure[type].match(/^(((((.*?)[^/]*{volume}[^/]*?)\/(?:.*?\/)*?)[^/]*?{chapter}[^/]*?)\/(?:.*?\/)*?)[^/]*?{page}.*$/) || ["", "", "", ""];
		return { page, pages, chapter, chapters, volume, volumes };
	}

	private async getVolumes () {
		return (await FileSystem.readdir(this.getVolumeDirectory("raw")))
			.filter(volume => this.getRegex("raw", "volume").test(volume))
			.sort()
			.map(async volume => tuple(volume, await this.getChapters(volume)))
			.stream()
			.collect(IndexedMap.createAsync);
	}

	private async getChapters (volume: string) {
		return (await FileSystem.readdir(this.getChapterDirectory("raw", volume)))
			.filter(chapter => this.getRegex("raw", "chapter", rs => rs.replace("$", "(\\.\\d)?$")).test(chapter))
			.sort()
			.map(async chapter => tuple(chapter, await this.getPages(volume, chapter)))
			.stream()
			.collect(IndexedMap.createAsync);
	}

	private async getPages (volume: string, chapter: string) {
		return (await (await FileSystem.readdir(this.getPageDirectory("raw", volume, chapter)))
			.filter(page => this.getRegex("raw", "page").test(page))
			.sort()
			.map(async (page): Promise<Page> => ({
				filename: page,
				captures: await new Captures(this.getPath("capture", volume, chapter, page)).load(),
			}))
			.stream().rest())
			.toArray();
	}

	private interpolate (directory: string, volume?: string | number, chapter?: string | number, page?: string | number) {
		const volName = volume === undefined ? undefined : this.getSegment("volume", volume);
		const chName = chapter === undefined ? undefined : this.getSegment("chapter", chapter);
		const pageName = page === undefined ? undefined : this.getSegment("page", page);
		const d = {
			volume: volName,
			volumeDigits: volName?.replace(/[^\d]/g, ""),
			chapter: chName,
			chapterDigits: chName?.replace(/[^\d]/g, ""),
			page: pageName,
			pageDigits: pageName?.replace(/[^\d]/g, ""),
		};
		return Path.join(this.root, interpolate(interpolate(directory, d), d));
	}

	private getRegex (type: PagePathType, segment: PagePathSegment, post: (rs: string) => string = rs => rs) {
		return RegExp(post(`^${this.getBaseFileName(type, segment)}$`.replace(/#/g, "\\d")));
	}

	private getBaseFileName (type: PagePathType, segment: PagePathSegment, digitsVarsAs = "#") {
		const configuredPath = this.structure[type];
		const directories = this.directories(type);
		const self = directories[segment];
		const directory = directories[`${segment}s`];
		const configuredBaseName = configuredPath.slice(directory.length, self.length);
		const o = {
			volume: this.structure.volume,
			volumeDigits: digitsVarsAs.repeat(this.structure.volume.replace(/[^#]/g, "").length),
			chapter: this.structure.chapter,
			chapterDigits: digitsVarsAs.repeat(this.structure.chapter.replace(/[^#]/g, "").length),
			page: this.structure.page,
			pageDigits: digitsVarsAs.repeat(this.structure.page.replace(/[^#]/g, "").length),
		};
		const interpolatedBase = interpolate(interpolate(configuredBaseName, o), o);
		return interpolatedBase;
	}

	private getSegment (name: PagePathSegment, value: number | string) {
		let segment = this.structure[name];
		if (name === "chapter" && !Number.isInteger(parseFloat(`${value}`))) segment = segment.replace("#", "###");
		return typeof value === "string" ? value : segment.replace(/#+/, match => pad(value, match.length));
	}

}
