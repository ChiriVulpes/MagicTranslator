import Collectors from "util/Collectors";
import { tuple } from "util/IterableIterator";
import IndexedMap from "util/Map";

export class VolumesImpl extends IndexedMap<string, IndexedMap<string, string[]>> {
	public async load () {
		await this.addAllAsync(this.getVolumes());
	}

	public getPaths (volume: number): [string];
	public getPaths (volume: number, chapter: number): [string, string];
	public getPaths (volume: number, chapter: number, page: number): [string, string, string];
	public getPaths (volume: number, chapter: number, page?: number): [string, string, string?];
	public getPaths (volume: number, chapter?: number, page?: number): [string, string?, string?];
	public getPaths (volume: number, chapter?: number, page?: number): [string, string?, string?] {
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
	public getNumbers (volume: number, chapter?: number, page?: number): [number, number?, number?] {
		const [volumeString, chapterString, pageString] = this.getPaths(volume, chapter, page);
		return [+volumeString.slice(3), chapterString && +chapterString.slice(2), pageString && +pageString.slice(0, -4)] as any;
	}

	////////////////////////////////////
	// Loading the map of Volumes/Chapters/Pages
	//

	private async getVolumes () {
		return (await fs.readdir(options.root))
			.sort()
			.values()
			.filter(volume => /vol\d\d/.test(volume))
			.map(async volume => tuple(volume, await this.getChapters(volume)))
			.awaitAll();
	}

	private async getChapters (volume: string) {
		return (await fs.readdir(`${options.root}/${volume}`))
			.sort()
			.values()
			.filter(chapter => /ch\d\d\d/.test(chapter))
			.map(async chapter => tuple(chapter, await this.getPages(volume, chapter)))
			.awaitAll()
			.collect(IndexedMap.createAsync);
	}

	private async getPages (volume: string, chapter: string) {
		return (await fs.readdir(`${options.root}/${volume}/${chapter}/raw`))
			.sort()
			.values()
			.filter(page => /\d\d\d\.png/.test(page))
			.collect(Collectors.toArray);
	}
}

const Volumes = new VolumesImpl();

export default Volumes;
