import Component from "component/Component";
import Header from "component/header/Header";
import Dialog from "data/Dialog";
import Volumes from "data/Volumes";
import { sleep } from "util/Async";
import Bound from "util/Bound";
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
	private readonly explorerWrapper: Component;
	private readonly actionWrapper: Component;

	public constructor(private readonly startLocation?: [number, number]) {
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

		for (const [volumeIndex, volume, chapters] of Volumes.indexedEntries()) {
			const [firstChapterName, firstChapterPages] = chapters.entries().first()!;
			const firstPage = firstChapterPages.first();

			new ImageButton(`${options.root}/${volume}/${firstChapterName}/raw/${firstPage}`)
				.setText(() => new Translation("volume").get(+volume.slice(3)))
				.listeners.add("click", () => this.showChapters(volumeIndex))
				.appendTo(this.explorerWrapper);
		}

		Header.setTitle(() => new Translation("title").get());
	}

	private addBackButton (handler: () => void) {
		new Component("button")
			.setText("back")
			.listeners.add("click", handler)
			.appendTo(this.actionWrapper);

		Component.window.listeners.until(this.listeners.waitFor("back"))
			.add("keyup", this.keyup, true);

		this.listeners.until("back").add("back", () => sleep(0.001).then(handler));
	}

	private showChapters (volume: number) {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		this.addBackButton(this.showVolumes);

		new Component("button")
			.classes.toggle(volume === Volumes.size - 1, "disabled")
			.setText("next-volume")
			.listeners.add("click", () => this.showChapters(volume + 1))
			.appendTo(this.actionWrapper);

		new Component("button")
			.classes.toggle(volume === 0, "disabled")
			.setText("prev-volume")
			.listeners.add("click", () => this.showChapters(volume - 1))
			.appendTo(this.actionWrapper);

		const [volumePath] = Volumes.getPaths(volume);
		const [volumeNumber] = Volumes.getNumbers(volume);
		const chapters = Volumes.getByIndex(volume)!;

		for (const [index, chapter, pages] of chapters.indexedEntries()) {
			const firstPage = pages.first();

			const [, chapterNumber] = Volumes.getNumbers(volume, index);

			new ImageButton(`${options.root}/${volumePath}/${chapter}/raw/${firstPage}`)
				.setText(() => new Translation("chapter").get(chapterNumber))
				.listeners.add("click", () => this.showPages(volume, index))
				.appendTo(this.explorerWrapper);
		}

		Header.setTitle(() => new Translation("title").get({ volume: volumeNumber }));
	}

	private async showPages (volume: number, chapter: number) {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		this.addBackButton(() => this.showChapters(volume));

		const chapters = Volumes.getByIndex(volume)!;

		new Component("button")
			.classes.toggle(chapter === chapters.size - 1, "disabled")
			.setText("next-chapter")
			.listeners.add("click", () => this.showPages(volume, chapter + 1))
			.appendTo(this.actionWrapper);

		new Component("button")
			.classes.toggle(chapter === 0, "disabled")
			.setText("prev-chapter")
			.listeners.add("click", () => this.showPages(volume, chapter - 1))
			.appendTo(this.actionWrapper);

		new Component("button")
			.classes.add("float-right")
			.setText("export")
			.listeners.add("click", () => this.export(volume, chapter))
			.appendTo(this.actionWrapper);

		const [volumePath, chapterPath] = Volumes.getPaths(volume, chapter);
		const [volumeNumber, chapterNumber] = Volumes.getNumbers(volume, chapter);
		const pages = await Volumes.getByIndex(volume)!.getByIndex(chapter)!;

		for (let i = 0; i < pages.length; i++) {
			const page = pages[i];

			const [, , pageNumber] = Volumes.getNumbers(volume, chapter, i);

			new ImageButton(`${options.root}/${volumePath}/${chapterPath}/raw/${page}`)
				.setText(() => new Translation("page").get(pageNumber))
				.listeners.add("click", () => this
					.emit<[number, number, number, boolean, boolean]>("extract", event => event
						.data = tuple(volume, chapter, i, i > 0, i < pages.length - 1)))
				.appendTo(this.explorerWrapper);
		}

		Header.setTitle(() => new Translation("title").get({ volume: volumeNumber, chapter: chapterNumber }));
	}

	@Bound
	private async export (volume: number, chapter: number) {
		await Dialog.export(volume, chapter);
	}
}
