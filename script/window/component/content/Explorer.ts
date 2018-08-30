import Component from "component/Component";
import { sleep } from "util/Async";
import Bound from "util/Bound";
import Collectors from "util/Collectors";
import { tuple } from "util/IterableIterator";
import Translation from "util/string/Translation";

/*
async function getImageData (path: string) {
	return `data:image/png;base64,${await fs.readFile(path, "base64")}`;
}
*/

class ImageButton extends Component {
	public constructor(private readonly path: string) {
		super("a");
		this.classes.add("image-button");
		this.attributes.set("href", "#");
		this.loadPreview();
	}

	public refreshText () {
		this.style.set("--text", `"${this.textGenerator ? `${this.textGenerator()}` : ""}"`);
		return this;
	}

	private async loadPreview () {
		this.style.set("--preview", `url("${this.path}")`);
	}
}

export default class Explorer extends Component {
	private volumes: Map<string, Map<string, string[]>>;
	private readonly explorerWrapper: Component;
	private readonly actionWrapper: Component;

	public constructor(private readonly startLocation?: [string, string]) {
		super();
		this.setId("explorer");

		this.actionWrapper = new Component()
			.classes.add("action-wrapper")
			.appendTo(this);

		new Component()
			.classes.add("explorer-wrapper")
			.append(this.explorerWrapper = new Component()
				.classes.add("explorer-links"))
			.appendTo(this);

		this.initialize();
	}

	private async initialize () {
		this.volumes = await this.getVolumes();

		if (!this.startLocation) {
			this.showVolumes();
			return;
		}

		await this.showPages(...this.startLocation);
	}

	@Bound
	private keyup (event: KeyboardEvent) {
		if (event.code === "Escape") this.emit("back");
	}

	@Bound
	private showVolumes () {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		for (const [volume, chapters] of this.volumes.entries()) {
			const [firstChapterName, firstChapterPages] = chapters.entries().first()!;
			const firstPage = firstChapterPages.first();

			new ImageButton(`${options.root}/${volume}/${firstChapterName}/raw/${firstPage}`)
				.setText(() => new Translation("volume").get(+volume.slice(3)))
				.listeners.add("click", () => this.showChapters(volume))
				.appendTo(this.explorerWrapper);
		}
	}

	private bindBack (handler: () => void) {
		Component.window.listeners.until(this.listeners.waitFor("back"))
			.add("keyup", this.keyup, true);

		this.listeners.until("back").add("back", () => sleep(0.001).then(handler));
	}

	private showChapters (volume: string) {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		new Component("button")
			.setText("back")
			.listeners.add("click", this.showVolumes)
			.appendTo(this.actionWrapper);

		this.bindBack(this.showVolumes);

		const chapters = this.volumes.get(volume)!;
		for (const [chapter, pages] of chapters.entries()) {
			const firstPage = pages.first();

			new ImageButton(`${options.root}/${volume}/${chapter}/raw/${firstPage}`)
				.setText(() => new Translation("chapter").get(+chapter.slice(2)))
				.listeners.add("click", () => this.showPages(volume, chapter))
				.appendTo(this.explorerWrapper);
		}
	}

	private async showPages (volume: string, chapter: string) {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		new Component("button")
			.setText("back")
			.listeners.add("click", () => this.showChapters(volume))
			.appendTo(this.actionWrapper);

		this.bindBack(() => this.showChapters(volume));

		const pages = await this.volumes.get(volume)!.get(chapter)!.values();

		for (const page of pages) {
			new ImageButton(`${options.root}/${volume}/${chapter}/raw/${page}`)
				.setText(() => new Translation("page").get(parseInt(page)))
				.listeners.add("click", () => this.emit<[string, string, string]>("extract", event => event.data = tuple(volume, chapter, page)))
				.appendTo(this.explorerWrapper);
		}
	}

	////////////////////////////////////
	// Loading the map of Volumes/Chapters/Pages
	//

	private async getVolumes () {
		return (await fs.readdir(options.root)).values()
			.filter(volume => /vol\d\d/.test(volume))
			.map(async volume => tuple(volume, await this.getChapters(volume)))
			.awaitAll()
			.collect(Map.createAsync);
	}

	private async getChapters (volume: string) {
		return (await fs.readdir(`${options.root}/${volume}`)).values()
			.filter(chapter => /ch\d\d\d/.test(chapter))
			.map(async chapter => tuple(chapter, await this.getPages(volume, chapter)))
			.awaitAll()
			.collect(Map.createAsync);
	}

	private async getPages (volume: string, chapter: string) {
		return (await fs.readdir(`${options.root}/${volume}/${chapter}/raw`)).values()
			.filter(page => /\d\d\d\.png/.test(page))
			.collect(Collectors.toArray);
	}
}
