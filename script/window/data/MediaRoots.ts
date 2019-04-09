import Captures from "data/Captures";
import Characters from "data/Characters";
import Serializable, { Serialized } from "data/Serialized";
import { tuple } from "util/Arrays";
import FileSystem from "util/FileSystem";
import IndexedMap from "util/Map";
import Stream from "util/stream/Stream";
import { interpolate } from "util/string/Interpolator";
import { mask, pad } from "util/string/String";

export default new class Media extends Map<string, MediaRoot> {
	public async load () {
		(await this.getRoots())
			.toMap(this);
	}

	public async addRoot (root: string) {
		this.set(root, await new MediaRoot(root).load());
	}

	private async getRoots () {
		return options.rootFolders.stream()
			.map(async root => tuple(root, await new MediaRoot(root).load()))
			.rest();
	}
};

export interface Page {
	filename: string;
	captures: Captures;
}

export interface RootMetadata {
	name?: string;
	structure: {
		volume: string;
		chapter: string;
		page: string;
		raw: string;
		translated: string;
		capture: string;
		save: string;
	};
}

class MediaRoot extends Serializable {

	public readonly characters = new Characters(this.root);

	@Serialized public name: string | undefined;
	@Serialized public structure: RootMetadata["structure"] = {
		volume: "vol##",
		chapter: "ch###",
		page: "###",
		raw: "{volume}/{chapter}/raws/{page}.png",
		translated: "{volume}/{chapter}/translated/{page}.png",
		capture: "{volume}/{chapter}/capture/{page}",
		save: "{volume}/{chapter}/save/{page}",
	};

	public volumes: IndexedMap<string, IndexedMap<string, Page[]>>;

	public constructor (private readonly root: string) {
		super(`${root}/metadata.json`);
	}

	public getDisplayName () {
		return this.name || path.basename(this.root);
	}

	@Override public async load () {
		await super.load();
		this.volumes = await this.getVolumes();
		return this;
	}

	public getPath (pathType: "raw" | "translated" | "capture" | "save", volume: number, chapter: number, page: number): string;
	public getPath (pathType: "raw" | "translated" | "capture" | "save", volume: string, chapter: string, page: string): string;
	public getPath (pathType: "raw" | "translated" | "capture" | "save", volume: string | number, chapter: string | number, page: string | number) {
		[volume, chapter, page] = this.getNumbers(volume as number, chapter as number, page as number);
		const result = path.join(this.root, interpolate(this.structure[pathType], Stream.entries({ volume, chapter, page })
			.map(([name, value]) => tuple(name, this.getSegment(name, value)))
			.toObject()));

		return result;
	}

	public getPage (volume: number, chapter: number, page: number) {
		return this.volumes.getByIndex(volume)!.getByIndex(chapter)![page];
	}

	public getPaths (volume: number): [string];
	public getPaths (volume: number, chapter: number): [string, string];
	public getPaths (volume: number, chapter: number, page: number): [string, string, string];
	public getPaths (volume: number, chapter: number, page?: number): [string, string?, string?];
	public getPaths (volume: number, chapter?: number, page?: number): [string?, string?, string?];
	public getPaths (volume: number, chapter?: number, page?: number): [string?, string?, string?] {
		const volumeString = this.volumes.getKey(volume);
		if (chapter === undefined) return [volumeString];

		const chapters = this.volumes.get(volumeString)!;
		const chapterString = chapters.getKey(chapter);
		if (page === undefined) return [volumeString, chapterString];

		const pages = chapters.get(chapterString)!;
		return [volumeString, chapterString, pages[page] && pages[page].filename];
	}

	public getNumbers (volume: number): [number];
	public getNumbers (volume: number, chapter: number): [number, number];
	public getNumbers (volume: number, chapter: number, page: number): [number, number, number];
	public getNumbers (volume: number, chapter: number, page?: number): [number, number, number?];
	public getNumbers (volume: number, chapter?: number, page?: number): [number, number?, number?];
	public getNumbers (volume: string): [number];
	public getNumbers (volume: string, chapter: string): [number, number];
	public getNumbers (volume: string, chapter: string, page: string): [number, number, number];
	public getNumbers (volume: string, chapter: string, page?: string): [number, number, number?];
	public getNumbers (volume: string, chapter?: string, page?: string): [number, number?, number?];
	public getNumbers (volume: number | string, chapter?: number | string, page?: number | string): [number?, number?, number?] {
		if (typeof volume === "number") {
			[volume, chapter, page] = this.getPaths(volume, chapter as number, page as number);
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

	private getRegex (key: keyof RootMetadata["structure"], post: (rs: string) => string = rs => rs) {
		return RegExp(post(`^${this.structure[key]}$`.replace(/#/g, "\\d")));
	}

	private getSegment (name: "volume" | "chapter" | "page", value: number | string) {
		let segment = this.structure[name];
		if (name === "chapter" && !Number.isInteger(parseFloat(`${value}`))) segment = segment.replace("#", "###");
		return typeof value === "string" ? value : segment.replace(/#+/, match => pad(value, match.length));
	}

	private getVolumeDirectory (type: keyof RootMetadata["structure"]) {
		const [, match] = /^([^{}]*?){volume}/.match(this.structure[type]);
		return path.join(this.root, match);
	}

	private getChapterDirectory (type: keyof RootMetadata["structure"], volume: string | number) {
		const [, match] = /^([^{}]*?{volume}[^{}]*?){chapter}/.match(this.structure[type]);
		return path.join(this.root, interpolate(match, { volume: this.getSegment("volume", volume) }));
	}

	private getPageDirectory (type: keyof RootMetadata["structure"], volume: string | number, chapter: string | number) {
		const [, match] = /^([^{}]*?{volume}[^{}]*?{chapter}[^{}]*?){page}/.match(this.structure[type]);
		return path.join(this.root, interpolate(match, {
			volume: this.getSegment("volume", volume),
			chapter: this.getSegment("chapter", chapter),
		}));
	}

}
