import { tuple } from "util/Arrays";
import FileSystem from "util/FileSystem";
import IndexedMap from "util/Map";

export default class Volumes extends IndexedMap<string, IndexedMap<string, string[]>> {
	public static async get (root: string) {
		return (await FileSystem.readdir(root))
			.sort()
			.values()
			.filter(volume => /vol\d\d/.test(volume))
			.map(async volume => tuple(volume, await getChapters(root, volume)))
			.collect(new Volumes().addAllAsync);
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
		return [volumeString && +volumeString.slice(3), chapterString && +chapterString.slice(2), pageString && +pageString.slice(0, -4)] as any;
	}
}

async function getChapters (root: string, volume: string) {
	return (await FileSystem.readdir(`${root}/${volume}`))
		.sort()
		.values()
		.filter(chapter => /ch\d\d\d/.test(chapter))
		.map(async chapter => tuple(chapter, await getPages(root, volume, chapter)))
		.collect(IndexedMap.createAsync);
}

async function getPages (root: string, volume: string, chapter: string) {
	return (await FileSystem.readdir(`${root}/${volume}/${chapter}/raw`))
		.sort()
		.filter(page => /\d\d\d\.png/.test(page));
}
