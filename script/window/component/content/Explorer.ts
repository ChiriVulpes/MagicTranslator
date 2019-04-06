import Component, { TextGenerator } from "component/Component";
import CharacterEditor from "component/content/character/CharacterEditor";
import Header from "component/header/Header";
import Interrupt from "component/shared/Interrupt";
import Tooltip from "component/shared/Tooltip";
import Dialog from "data/Dialog";
import Volumes from "data/Volumes";
import Options from "Options";
import { tuple } from "util/Arrays";
import { sleep } from "util/Async";
import Bound from "util/Bound";
import Translation from "util/string/Translation";

/*
async function getImageData (path: string) {
	return `data:image/png;base64,${await fs.readFile(path, "base64")}`;
}
*/

class ImageButton extends Component {
	protected readonly title = new Component()
		.classes.add("title")
		.schedule(Tooltip.register, (tooltip: Tooltip) => tooltip
			.setText(this.textGenerator))
		.appendTo(this);

	public constructor (private readonly imagePath: string) {
		super("a");
		this.classes.add("image-button");
		this.attributes.set("href", "#");
		this.loadPreview();
	}

	public setText (text: TextGenerator) {
		super.setText(text);
		this.title.setText(text);
		return this;
	}

	public refreshText () {
		this.title.refreshText();
		return this;
	}

	private async loadPreview () {
		this.style.set("--preview", `url("${this.imagePath}")`);
	}
}

class RootButton extends ImageButton {
	private static getRootPath (root: string) {
		const [, firstVolumeName, firstVolumeChapters] = Volumes.get(root)!.volumes.indexedEntries().first(undefined, tuple<any>());
		const [firstChapterName, firstChapterPages] = (firstVolumeChapters || []).entryStream().first(undefined, tuple<any>());
		const firstPage = (firstChapterPages || [])[0];
		return `${root}/${firstVolumeName}/${firstChapterName}/raw/${firstPage}`;
	}

	public constructor (private readonly root: string) {
		super(RootButton.getRootPath(root));
		this.classes.add("root-button");
		this.setText(() => path.basename(root));

		new Component("button")
			.setText("remove")
			.listeners.add("click", this.onRemove)
			.appendTo(this);
	}

	@Bound
	private async onRemove (event: Event) {
		event.stopPropagation();

		const confirm = await Interrupt.confirm(interrupt => interrupt
			.setTitle(() => new Translation("confirm-remove-root").get(path.basename(this.root)))
			.setDescription("confirm-remove-root-description"));
		if (!confirm) return;

		Volumes.delete(this.root);
		options.rootFolders.splice(options.rootFolders.indexOf(this.root), 1);
		this.remove();
	}
}

export default class Explorer extends Component {
	private readonly explorerWrapper: Component;
	private readonly actionWrapper: Component;

	public constructor (private readonly startLocation?: [string, number, number]) {
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
			this.showRoots();
			return;
		}

		await this.showPages(...this.startLocation);
	}

	@Bound
	private showRoots () {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		for (const root of Volumes.keys()) {
			new RootButton(root)
				.listeners.add("click", () => this.showVolumes(root))
				.appendTo(this.explorerWrapper);
		}

		new Component("button")
			.setText("add-root")
			.listeners.add("click", this.addRoot)
			.appendTo(this.actionWrapper);

		Header.setTitle(() => new Translation("title").get());
	}

	@Bound
	private async addRoot () {
		const root = await Options.chooseFolder("prompt-root-folder");
		if (root) {
			options.rootFolders.push(root);
			await Volumes.addRoot(root);
			this.showVolumes(root);
		}
	}

	private async showVolumes (root: string) {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		await CharacterEditor.setRoot(root);

		this.addBackButton(this.showRoots);

		for (const [volumeIndex, volume, chapters] of Volumes.get(root)!.volumes.indexedEntries()) {
			const [firstChapterName, firstChapterPages] = chapters.entryStream().first()!;
			const firstPage = firstChapterPages[0];

			new ImageButton(`${root}/${volume}/${firstChapterName}/raw/${firstPage}`)
				.setText(() => new Translation("volume").get(+volume.slice(3)))
				.listeners.add("click", () => this.showChapters(root, volumeIndex))
				.appendTo(this.explorerWrapper);
		}

		Header.setTitle(() => new Translation("title").get({ root: path.basename(root) }));
	}

	private showChapters (root: string, volume: number) {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		this.addBackButton(() => this.showVolumes(root));

		new Component("button")
			.classes.toggle(volume === 0, "disabled")
			.setText("prev-volume")
			.listeners.add("click", () => this.showChapters(root, volume - 1))
			.appendTo(this.actionWrapper);

		new Component("button")
			.classes.toggle(volume === Volumes.get(root)!.volumes.size - 1, "disabled")
			.setText("next-volume")
			.listeners.add("click", () => this.showChapters(root, volume + 1))
			.appendTo(this.actionWrapper);

		const [, volumePath] = Volumes.getPaths(root, volume);
		const [, volumeNumber] = Volumes.getNumbers(root, volume);
		const chapters = Volumes.get(root)!.volumes.getByIndex(volume)!;

		for (const [index, chapter, pages] of chapters.indexedEntries()) {
			const firstPage = pages[0];

			const [, , chapterNumber] = Volumes.getNumbers(root, volume, index);

			new ImageButton(`${root}/${volumePath}/${chapter}/raw/${firstPage}`)
				.setText(() => new Translation("chapter").get(chapterNumber))
				.listeners.add("click", () => this.showPages(root, volume, index))
				.appendTo(this.explorerWrapper);
		}

		Header.setTitle(() => new Translation("title").get({ root: path.basename(root), volume: volumeNumber }));
	}

	private async showPages (root: string, volume: number, chapter: number) {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		this.addBackButton(() => this.showChapters(root, volume));

		const chapters = Volumes.get(root)!.volumes.getByIndex(volume)!;

		new Component("button")
			.classes.toggle(chapter === 0, "disabled")
			.setText("prev-chapter")
			.listeners.add("click", () => this.showPages(root, volume, chapter - 1))
			.appendTo(this.actionWrapper);

		new Component("button")
			.classes.toggle(chapter === chapters.size - 1, "disabled")
			.setText("next-chapter")
			.listeners.add("click", () => this.showPages(root, volume, chapter + 1))
			.appendTo(this.actionWrapper);

		new Component("button")
			.classes.add("float-right")
			.setText("export")
			.listeners.add("click", () => this.export(root, volume, chapter))
			.appendTo(this.actionWrapper);

		new Component("button")
			.classes.add("float-right")
			.setText("import")
			.listeners.add("click", () => this.import(root, volume, chapter))
			.appendTo(this.actionWrapper);

		const [, volumePath, chapterPath] = Volumes.getPaths(root, volume, chapter);
		const [, volumeNumber, chapterNumber] = Volumes.getNumbers(root, volume, chapter);
		const pages = await Volumes.get(root)!.volumes.getByIndex(volume)!.getByIndex(chapter)!;

		for (let i = 0; i < pages.length; i++) {
			const page = pages[i];

			const [, , , pageNumber] = Volumes.getNumbers(root, volume, chapter, i);

			new ImageButton(`${root}/${volumePath}/${chapterPath}/raw/${page}`)
				.setText(() => new Translation("page").get(pageNumber))
				.listeners.add("click", () => this
					.emit<[string, number, number, number, boolean, boolean]>("extract", event => event
						.data = tuple(root, volume, chapter, i, i > 0, i < pages.length - 1)))
				.appendTo(this.explorerWrapper);
		}

		Header.setTitle(() => new Translation("title").get({ root: path.basename(root), volume: volumeNumber, chapter: chapterNumber }));
	}

	@Bound
	private async export (root: string, volume: number, chapter: number) {
		await Dialog.export(root, volume, chapter);
	}

	@Bound
	private async import (root: string, volume: number, chapter: number) {
		await Dialog.import(root, volume, chapter);
	}

	@Bound
	private keyup (event: KeyboardEvent) {
		if (event.code === "Escape") this.emit("back");
	}

	private addBackButton (handler: () => void) {
		new Component("button")
			.setText("back")
			.listeners.add("click", handler)
			.appendTo(this.actionWrapper);

		Component.window.listeners.until(this.listeners.waitFor(["back", "remove"]))
			.add("keyup", this.keyup, true);

		this.listeners.until("back").add("back", () => sleep(0.001).then(handler));
	}
}

// regexes for converting old dialog.md to importable dialog.md
// \n\-(?!--)(?:\s*(.*?):(?!\/\/))?\s*(.*?)(?=\n)
// replace: \n| $1 | $2 |
// ([^\|])(\n\|)
// replace: $1\n| Text | Note |\n| --- | --- |$2
// \[Page.*?raw/(\d+).png\)\n---
// replace: # Page $1
