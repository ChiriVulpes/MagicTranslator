import Component, { TextGenerator } from "component/Component";
import CharacterEditor from "component/content/character/CharacterEditor";
import GlobalSettings from "component/content/GlobalSettings";
import RootSettings from "component/content/RootSettings";
import Header from "component/header/Header";
import Tooltip from "component/shared/Tooltip";
import Dialog from "data/Dialog";
import MediaRoots from "data/MediaRoots";
import Options from "Options";
import { tuple } from "util/Arrays";
import { sleep } from "util/Async";
import Translation from "util/string/Translation";

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

	@Bound private showRoots () {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		MediaRoots.keys().forEach(this.addRootButton);

		new Component("button")
			.setText("add-root")
			.listeners.add("click", this.addRoot)
			.appendTo(this.actionWrapper);

		new Component("button")
			.classes.add("float-right")
			.setText("settings")
			.listeners.add("click", this.onSettings)
			.appendTo(this.actionWrapper);

		Header.setTitle(() => new Translation("title").get());
	}

	@Bound private onSettings () {
		new GlobalSettings();
	}

	@Bound private addRootButton (root: string) {
		new RootButton(root)
			.listeners.add("click", () => this.showVolumes(root))
			.listeners.add("refresh-roots", this.showRoots)
			.appendTo(this.explorerWrapper);
	}

	@Bound private async addRoot () {
		const root = await Options.chooseFolder("prompt-root-folder");
		if (root) {
			options.rootFolders.push(root);
			await MediaRoots.addRoot(root);
			this.addRootButton(root);
		}
	}

	private async showVolumes (root: string) {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		await CharacterEditor.setRoot(root);

		this.addBackButton(this.showRoots);

		const mediaRoot = MediaRoots.get(root)!;

		// Dropdown.from(mediaRoot.users)
		// 	.classes.add("float-right")
		// 	.appendTo(this.actionWrapper);

		for (const [volumeIndex, volume, chapters] of mediaRoot.volumes.indexedEntries()) {
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

		const volumes = MediaRoots.get(root)!.volumes;

		new Component("button")
			.setDisabled(volume === 0)
			.setText("prev-volume")
			.listeners.add("click", () => this.showChapters(root, volume - 1))
			.appendTo(this.actionWrapper);

		new Component("button")
			.setDisabled(volume === volumes.size - 1)
			.setText("next-volume")
			.listeners.add("click", () => this.showChapters(root, volume + 1))
			.appendTo(this.actionWrapper);

		const [volumePath] = volumes.getPaths(volume);
		const [volumeNumber] = volumes.getNumbers(volume);
		const chapters = volumes.getByIndex(volume)!;

		for (const [index, chapter, pages] of chapters.indexedEntries()) {
			const firstPage = pages[0];

			const [, chapterNumber] = volumes.getNumbers(volume, index);

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

		const volumes = MediaRoots.get(root)!.volumes;
		const chapters = volumes.getByIndex(volume)!;

		new Component("button")
			.setDisabled(chapter === 0)
			.setText("prev-chapter")
			.listeners.add("click", () => this.showPages(root, volume, chapter - 1))
			.appendTo(this.actionWrapper);

		new Component("button")
			.setDisabled(chapter === chapters.size - 1)
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

		const [volumePath, chapterPath] = volumes.getPaths(volume, chapter);
		const [volumeNumber, chapterNumber] = volumes.getNumbers(volume, chapter);
		const pages = await volumes.getByIndex(volume)!.getByIndex(chapter)!;

		for (let i = 0; i < pages.length; i++) {
			const page = pages[i];

			const [, , pageNumber] = volumes.getNumbers(volume, chapter, i);

			new ImageButton(`${root}/${volumePath}/${chapterPath}/raw/${page}`)
				.setText(() => new Translation("page").get(pageNumber))
				.listeners.add("click", () => this
					.emit<[string, number, number, number, boolean, boolean]>("extract", event => event
						.data = tuple(root, volume, chapter, i, i > 0, i < pages.length - 1)))
				.appendTo(this.explorerWrapper);
		}

		Header.setTitle(() => new Translation("title").get({ root: path.basename(root), volume: volumeNumber, chapter: chapterNumber }));
	}

	@Bound private async export (root: string, volume: number, chapter: number) {
		await Dialog.export(root, volume, chapter);
	}

	@Bound private async import (root: string, volume: number, chapter: number) {
		await Dialog.import(root, volume, chapter);
	}

	@Bound private keyup (event: KeyboardEvent) {
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

	@Override public setText (text: TextGenerator) {
		super.setText(text);
		this.title.setText(text);
		return this;
	}

	@Override public refreshText () {
		this.title.refreshText();
		return this;
	}

	private async loadPreview () {
		this.style.set("--preview", `url("${this.imagePath}")`);
	}
}

class RootButton extends ImageButton {
	private static getRootPath (root: string) {
		const [, firstVolumeName, firstVolumeChapters] = MediaRoots.get(root)!.volumes.indexedEntries().first(undefined, tuple<any>());
		const [firstChapterName, firstChapterPages] = (firstVolumeChapters || []).entryStream().first(undefined, tuple<any>());
		const firstPage = (firstChapterPages || [])[0];
		return `${root}/${firstVolumeName}/${firstChapterName}/raw/${firstPage}`;
	}

	public constructor (private readonly root: string) {
		super(RootButton.getRootPath(root));
		this.classes.add("root-button");
		this.setText(() => MediaRoots.get(root)!.name || path.basename(root));

		new Component("button")
			.setText("settings")
			.listeners.add("click", this.onSettings)
			.appendTo(this);
	}

	@Bound private async onSettings (event: Event) {
		event.stopPropagation();

		const rootSettings = new RootSettings(this.root);
		await rootSettings.listeners.waitFor("remove");

		if (rootSettings.wasFileStructureChanged()) {
			await MediaRoots.get(this.root)!.load();
			this.emit("refresh-roots");
		}

		if (!MediaRoots.has(this.root)) this.remove();
		else this.refreshText();
	}
}

// regexes for converting old dialog.md to importable dialog.md
// \n\-(?!--)(?:\s*(.*?):(?!\/\/))?\s*(.*?)(?=\n)
// replace: \n| $1 | $2 |
// ([^\|])(\n\|)
// replace: $1\n| Text | Note |\n| --- | --- |$2
// \[Page.*?raw/(\d+).png\)\n---
// replace: # Page $1
