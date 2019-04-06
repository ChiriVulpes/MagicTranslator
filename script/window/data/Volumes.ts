import Characters from "data/Characters";
import { tuple } from "util/Arrays";
import FileSystem from "util/FileSystem";
import IndexedMap from "util/Map";

interface Root {
	characters: Characters;
	volumes: IndexedMap<string, IndexedMap<string, string[]>>;
}

export class VolumesImpl extends Map<string, Root> {
	public async load () {
		(await this.getRoots())
			.toMap(this);
	}

	public async addRoot (root: string) {
		this.set(root, await this.getRoot(root));
	}

	public getPaths (root: string): [string];
	public getPaths (root: string, volume: number): [string, string];
	public getPaths (root: string, volume: number, chapter: number): [string, string, string];
	public getPaths (root: string, volume: number, chapter: number, page: number): [string, string, string, string];
	public getPaths (root: string, volume: number, chapter: number, page?: number): [string, string, string?, string?];
	public getPaths (root: string, volume: number, chapter?: number, page?: number): [string, string?, string?, string?];
	public getPaths (root: string, volume?: number, chapter?: number, page?: number): [string, string?, string?, string?];
	public getPaths (root: string, volume?: number, chapter?: number, page?: number): [string, string?, string?, string?] {
		const r = this.get(root)!;
		if (volume === undefined) return [root];

		const volumeString = r.volumes.getKey(volume);
		if (chapter === undefined) return [root, volumeString];

		const chapters = r.volumes.get(volumeString)!;
		const chapterString = chapters.getKey(chapter);
		if (page === undefined) return [root, volumeString, chapterString];

		const pages = chapters.get(chapterString)!;
		return [root, volumeString, chapterString, pages[page]];
	}

	public getNumbers (root: string): [string];
	public getNumbers (root: string, volume: number): [string, number];
	public getNumbers (root: string, volume: number, chapter: number): [string, number, number];
	public getNumbers (root: string, volume: number, chapter: number, page: number): [string, number, number, number];
	public getNumbers (root: string, volume: number, chapter: number, page?: number): [string, number, number, number?];
	public getNumbers (root: string, volume: number, chapter?: number, page?: number): [string, number, number?, number?];
	public getNumbers (root: string, volume?: number, chapter?: number, page?: number): [string, number?, number?, number?];
	public getNumbers (root: string, volume?: number, chapter?: number, page?: number): [string, number?, number?, number?] {
		const [, volumeString, chapterString, pageString] = this.getPaths(root, volume, chapter, page);
		return [root, volumeString && +volumeString.slice(3), chapterString && +chapterString.slice(2), pageString && +pageString.slice(0, -4)] as any;
	}

	////////////////////////////////////
	// Loading the map of Volumes/Chapters/Pages
	//

	private async getRoots () {
		return options.rootFolders.stream()
			.map(async root => tuple(root, await this.getRoot(root)))
			.rest();
	}

	private async getRoot (root: string): Promise<Root> {
		return {
			characters: new Characters(root),
			volumes: await this.getVolumes(root),
		};
	}

	private async getVolumes (root: string) {
		return (await FileSystem.readdir(root))
			.sort()
			.values()
			.filter(volume => /vol\d\d/.test(volume))
			.map(async volume => tuple(volume, await this.getChapters(root, volume)))
			.collect(IndexedMap.createAsync);
	}

	private async getChapters (root: string, volume: string) {
		return (await FileSystem.readdir(`${root}/${volume}`))
			.sort()
			.values()
			.filter(chapter => /ch\d\d\d/.test(chapter))
			.map(async chapter => tuple(chapter, await this.getPages(root, volume, chapter)))
			.collect(IndexedMap.createAsync);
	}

	private async getPages (root: string, volume: string, chapter: string) {
		return (await FileSystem.readdir(`${root}/${volume}/${chapter}/raw`))
			.sort()
			.filter(page => /\d\d\d\.png/.test(page));
	}
}

const Volumes = new VolumesImpl();

export default Volumes;
