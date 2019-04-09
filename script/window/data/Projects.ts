import Captures from "data/Captures";
import Characters from "data/Characters";
import Serializable, { Serialized } from "data/Serialized";
import { tuple } from "util/Arrays";
import FileSystem from "util/FileSystem";
import IndexedMap from "util/Map";
import Stream from "util/stream/Stream";
import { interpolate } from "util/string/Interpolator";
import Path from "util/string/Path";
import { mask, pad } from "util/string/String";

export default new class Projects extends Map<string, Project> {

	public current?: Project;

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
};

export interface Page {
	filename: string;
	captures: Captures;
}

function stringTuple<A extends string[]> (...args: A): A { return args; }

export const pathSegments = stringTuple("volume", "chapter", "page");
export type PagePathSegment = (typeof pathSegments)[number];
export module PagePathSegment {
	export function is (value: unknown): value is PagePathSegment {
		return pathSegments.includes(value as any);
	}
}

export const pathTypes = stringTuple("raw", "translated", "capture", "save");
export type PagePathType = (typeof pathTypes)[number];
export module PagePathType {
	export function is (value: unknown): value is PagePathType {
		return pathTypes.includes(value as any);
	}
}

export type ProjectStructure = typeof defaultProjectStructure;

const defaultProjectStructure = {
	volume: "vol##",
	chapter: "ch###",
	page: "###",
	characters: "character",
	raw: "{volume}/{chapter}/raw/{page}.png",
	translated: "{volume}/{chapter}/translated/{page}.png",
	capture: "{volume}/{chapter}/capture/{page}",
	save: "{volume}/{chapter}/save/{page}",
};

export class Project extends Serializable {

	public characters: Characters;

	@Serialized public name: string | undefined;
	@Serialized public structure: ProjectStructure = { ...defaultProjectStructure };

	public volumes: IndexedMap<string, IndexedMap<string, Page[]>>;

	public constructor (public readonly root: string) {
		super(`${root}/metadata.json`);
	}

	public getDisplayName () {
		return this.name || Path.basename(this.root);
	}

	@Override public async load () {
		await super.load();
		this.canSave = false;

		for (const key of Stream.keys(defaultProjectStructure)) {
			if (!(key in this.structure)) {
				this.structure[key] = defaultProjectStructure[key];
			}
		}

		this.canSave = true;

		this.characters = await new Characters(this.getPath("characters")).load();
		this.volumes = await this.getVolumes();
		return this;
	}

	public getPath (pathType: "characters"): string;
	public getPath (pathType: PagePathType, volume: number, chapter: number, page: number): string;
	public getPath (pathType: PagePathType, volume: string, chapter: string, page: string): string;
	public getPath (pathType: PagePathType | "characters", volume?: string | number, chapter?: string | number, page?: string | number) {
		if (pathType === "characters")
			return Path.join(this.root, this.structure[pathType]);

		[volume, chapter, page] = this.getSegmentNumbers(volume as number, chapter as number, page as number);
		const result = Path.join(this.root, interpolate(this.structure[pathType], Stream.entries({ volume, chapter, page })
			.map(([name, value]) => tuple(name, this.getSegment(name, value)))
			.toObject()));

		return result;
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
			parseFloat(mask(this.structure.volume.replace(/[^#]/g, " "), volume as string || "")),
			parseFloat(mask(this.structure.chapter.replace("#", "###").replace(/[^#]/g, " "), chapter as string || "")),
			parseFloat(mask(this.structure.page.replace(/[^#]/g, " "), page as string || "")),
		] as any;
	}

	private async getVolumes () {
		return (await FileSystem.readdir(this.getVolumeDirectory("raw")))
			.filter(volume => this.getRegex("volume").test(volume))
			.sort()
			.map(async volume => tuple(volume, await this.getChapters(volume)))
			.stream()
			.collect(IndexedMap.createAsync);
	}

	private async getChapters (volume: string) {
		return (await FileSystem.readdir(this.getChapterDirectory("raw", volume)))
			.filter(chapter => this.getRegex("chapter", rs => rs.replace("$", "(\\.\\d)?$")).test(chapter))
			.sort()
			.map(async chapter => tuple(chapter, await this.getPages(volume, chapter)))
			.stream()
			.collect(IndexedMap.createAsync);
	}

	private async getPages (volume: string, chapter: string) {
		return (await (await FileSystem.readdir(this.getPageDirectory("raw", volume, chapter)))
			.filter(page => this.getRegex("page", rs => rs.replace("$", ".png$")).test(page))
			.sort()
			.map(async (page): Promise<Page> => ({
				filename: page,
				captures: await new Captures(this.getPath("capture", volume, chapter, page)).load(),
			}))
			.stream().rest())
			.toArray();
	}

	private getRegex (key: keyof ProjectStructure, post: (rs: string) => string = rs => rs) {
		return RegExp(post(`^${this.structure[key]}$`.replace(/#/g, "\\d")));
	}

	private getSegment (name: PagePathSegment, value: number | string) {
		let segment = this.structure[name];
		if (name === "chapter" && !Number.isInteger(parseFloat(`${value}`))) segment = segment.replace("#", "###");
		return typeof value === "string" ? value : segment.replace(/#+/, match => pad(value, match.length));
	}

	private getVolumeDirectory (type: keyof ProjectStructure) {
		const [, match] = /^([^{}]*?){volume}/.match(this.structure[type]);
		return Path.join(this.root, match);
	}

	private getChapterDirectory (type: keyof ProjectStructure, volume: string | number) {
		const [, match] = /^([^{}]*?{volume}[^{}]*?){chapter}/.match(this.structure[type]);
		return Path.join(this.root, interpolate(match, { volume: this.getSegment("volume", volume) }));
	}

	private getPageDirectory (type: keyof ProjectStructure, volume: string | number, chapter: string | number) {
		const [, match] = /^([^{}]*?{volume}[^{}]*?{chapter}[^{}]*?){page}/.match(this.structure[type]);
		return Path.join(this.root, interpolate(match, {
			volume: this.getSegment("volume", volume),
			chapter: this.getSegment("chapter", chapter),
		}));
	}

}