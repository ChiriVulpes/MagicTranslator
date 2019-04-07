import Characters from "data/Characters";
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
		this.set(root, await MediaRoot.initialize(root));
	}

	private async getRoots () {
		return options.rootFolders.stream()
			.map(async root => tuple(root, await MediaRoot.initialize(root)))
			.rest();
	}
};

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

class MediaRoot {

	public static async initialize (root: string) {
		const jsonData = await FileSystem.readFile(`${root}/metadata.json`, "utf8")
			.catch(() => { });

		const metadata: Partial<RootMetadata> = JSON.parse(jsonData || "{}");

		return new MediaRoot(root, metadata.name, metadata.structure).load();
	}

	public readonly characters = new Characters(this.root);

	public get name () { return this._name; }
	public set name (name: string | undefined) { this._name = name; this.save(); }

	public get structure () {
		return new Proxy(this._structure, {
			set: (s: any, prop: any, val: any) => {
				s[prop] = val;
				this.save();
				return true;
			},
		});
	}
	public set structure (structure: RootMetadata["structure"]) { this._structure = structure; this.save(); }

	public volumes: Volumes;

	private constructor (
		private readonly root: string,
		private _name?: string,
		private _structure: RootMetadata["structure"] = {
			volume: "vol##",
			chapter: "ch###",
			page: "###",
			raw: "{volume}/{chapter}/raws/{page}.png",
			translated: "{volume}/{chapter}/translated/{page}.png",
			capture: "{volume}/{chapter}/capture/{page}",
			save: "{volume}/{chapter}/save/{page}",
		},
	) { }

	public getPath (pathType: "raw" | "translated" | "capture" | "save", volume: number, chapter: number, page: number) {
		[volume, chapter, page] = this.volumes.getNumbers(volume, chapter, page);
		return path.join(this.root, interpolate(this._structure[pathType], Stream.entries({ volume, chapter, page })
			.map(([name, value]) => tuple(name, this.getSegment(name, value)))
			.toObject()));
	}

	public async load () {
		this.volumes = await this.getVolumes();
		return this;
	}

	private async save () {
		const data: RootMetadata = {
			name: this._name,
			structure: this._structure,
		};

		await FileSystem.writeFile(`${this.root}/metadata.json`, JSON.stringify(data, undefined, "\t"));
	}

	private async getVolumes () {
		return (await FileSystem.readdir(this.getVolumeDirectory("raw")))
			.sort()
			.values()
			.filter(volume => this.getRegex("volume").test(volume))
			.map(async volume => tuple(volume, await this.getChapters(volume)))
			.collect(new Volumes(this._structure).addAllAsync);
	}

	private async getChapters (volume: string) {
		return (await FileSystem.readdir(this.getChapterDirectory("raw", volume)))
			.sort()
			.values()
			.filter(chapter => this.getRegex("chapter", rs => rs.replace("$", "(\\.\\d)?$")).test(chapter))
			.map(async chapter => tuple(chapter, await this.getPages(volume, chapter)))
			.collect(IndexedMap.createAsync);
	}

	private async getPages (volume: string, chapter: string) {
		return (await FileSystem.readdir(this.getPageDirectory("raw", volume, chapter)))
			.sort()
			.filter(page => this.getRegex("page", rs => rs.replace("$", ".png$")).test(page));
	}

	private getRegex (key: keyof RootMetadata["structure"], post: (rs: string) => string = rs => rs) {
		return RegExp(post(`^${this._structure[key]}$`.replace(/#/g, "\\d")));
	}

	private getSegment (name: "volume" | "chapter" | "page", value: number | string) {
		let segment = this._structure[name];
		if (name === "chapter" && !Number.isInteger(parseFloat(`${value}`))) segment = segment.replace("#", "###");
		return typeof value === "string" ? value : segment.replace(/#+/, match => pad(value, match.length));
	}

	private getVolumeDirectory (type: keyof RootMetadata["structure"]) {
		const [, match] = /^([^{}]*?){volume}/.match(this._structure[type]);
		return path.join(this.root, match);
	}

	private getChapterDirectory (type: keyof RootMetadata["structure"], volume: string | number) {
		const [, match] = /^([^{}]*?{volume}[^{}]*?){chapter}/.match(this._structure[type]);
		return path.join(this.root, interpolate(match, { volume: this.getSegment("volume", volume) }));
	}

	private getPageDirectory (type: keyof RootMetadata["structure"], volume: string | number, chapter: string | number) {
		const [, match] = /^([^{}]*?{volume}[^{}]*?{chapter}[^{}]*?){page}/.match(this._structure[type]);
		return path.join(this.root, interpolate(match, {
			volume: this.getSegment("volume", volume),
			chapter: this.getSegment("chapter", chapter),
		}));
	}

}

class Volumes extends IndexedMap<string, IndexedMap<string, string[]>> {

	public constructor (private readonly structure: RootMetadata["structure"]) {
		super();
	}

	public getPaths (volume: number): [string];
	public getPaths (volume: number, chapter: number): [string, string];
	public getPaths (volume: number, chapter: number, page: number): [string, string, string];
	public getPaths (volume: number, chapter: number, page?: number): [string, string?, string?];
	public getPaths (volume: number, chapter?: number, page?: number): [string?, string?, string?];
	public getPaths (volume: number, chapter?: number, page?: number): [string?, string?, string?] {
		const volumeString = this.getKey(volume);
		if (chapter === undefined) return [volumeString];

		const chapters = this.get(volumeString)!;
		const chapterString = chapters.getKey(chapter);
		if (page === undefined) return [volumeString, chapterString];

		const pages = chapters.get(chapterString)!;
		return [volumeString, chapterString, pages[page]];
	}

	public getNumbers (volume: number): [number];
	public getNumbers (volume: number, chapter: number): [number, number];
	public getNumbers (volume: number, chapter: number, page: number): [number, number, number];
	public getNumbers (volume: number, chapter: number, page?: number): [number, number, number?];
	public getNumbers (volume: number, chapter?: number, page?: number): [number, number?, number?];
	public getNumbers (volume: number, chapter?: number, page?: number): [number?, number?, number?] {
		const [volumeString, chapterString, pageString] = this.getPaths(volume, chapter, page);
		return [
			parseFloat(mask(this.structure.volume.replace(/[^#]/g, " "), volumeString || "")),
			parseFloat(mask(this.structure.chapter.replace("#", "###").replace(/[^#]/g, " "), chapterString || "")),
			parseFloat(mask(this.structure.page.replace(/[^#]/g, " "), pageString || "")),
		] as any;
	}
}
