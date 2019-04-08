import Component, { TextGenerator } from "component/Component";
import CharacterEditor from "component/content/character/CharacterEditor";
import GlobalSettings from "component/content/GlobalSettings";
import RootSettings from "component/content/RootSettings";
import Header from "component/header/Header";
import Tooltip from "component/shared/Tooltip";
import { CaptureData } from "data/Captures";
import Dialog from "data/Dialog";
import MediaRoots from "data/MediaRoots";
import Options from "Options";
import { tuple } from "util/Arrays";
import { sleep } from "util/Async";
import Stream from "util/stream/Stream";
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

	private async showVolumes (root: string) {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		await CharacterEditor.setRoot(root);

		this.addBackButton(this.showRoots);

		const mediaRoot = MediaRoots.get(root)!;

		// Dropdown.from(mediaRoot.users)
		// 	.classes.add("float-right")
		// 	.appendTo(this.actionWrapper);

		for (const [volumeIndex] of mediaRoot.volumes.indexedEntries()) {
			this.addImageButton(root, volumeIndex)
				.listeners.add("click", () => this.showChapters(root, volumeIndex));
		}

		Header.setTitle(() => new Translation("title").get({ root: mediaRoot.name }));
	}

	private showChapters (root: string, volume: number) {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		this.addBackButton(() => this.showVolumes(root));

		const mediaRoot = MediaRoots.get(root)!;

		new Component("button")
			.setDisabled(volume === 0)
			.setText("prev-volume")
			.listeners.add("click", () => this.showChapters(root, volume - 1))
			.appendTo(this.actionWrapper);

		new Component("button")
			.setDisabled(volume === mediaRoot.volumes.size - 1)
			.setText("next-volume")
			.listeners.add("click", () => this.showChapters(root, volume + 1))
			.appendTo(this.actionWrapper);

		const chapters = mediaRoot.volumes.getByIndex(volume)!;

		for (const [index] of chapters.indexedEntries()) {
			this.addImageButton(root, volume, index)
				.listeners.add("click", () => this.showPages(root, volume, index));
		}

		const [volumeNumber] = mediaRoot.getNumbers(volume);
		Header.setTitle(() => new Translation("title").get({
			root: mediaRoot.name,
			volume: `${volumeNumber}`,
		}));
	}

	private async showPages (root: string, volume: number, chapter: number) {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		this.addBackButton(() => this.showChapters(root, volume));

		const mediaRoot = MediaRoots.get(root)!;
		const chapters = mediaRoot.volumes.getByIndex(volume)!;

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

		const pages = await mediaRoot.volumes.getByIndex(volume)!.getByIndex(chapter)!;

		for (let i = 0; i < pages.length; i++) {
			this.addImageButton(root, volume, chapter, i)
				.listeners.add("click", () => this
					.emit<[string, number, number, number, boolean, boolean]>("extract", event => event
						.data = tuple(root, volume, chapter, i, i > 0, i < pages.length - 1)));
		}

		const [volumeNumber, chapterNumber] = mediaRoot.getNumbers(volume, chapter);
		Header.setTitle(() => new Translation("title").get({
			root: path.basename(root),
			volume: `${volumeNumber}`,
			chapter: `${chapterNumber}`,
		}));
	}

	@Bound private addRootButton (root: string) {
		return this.addImageButton(root)
			.classes.add("root-button")
			.listeners.add("click", () => this.showVolumes(root))
			.append(new Component("button")
				.setText("settings")
				.listeners.add("click", this.onRootSettings(root)));
	}

	private addImageButton (root: string, volume?: number, chapter?: number, page?: number) {
		const missingTranslations = this.getMissingTranslations(root, volume, chapter, page).count();

		let type: "root" | "volume" | "chapter" | "page" | undefined;
		[type, volume, chapter, page] = this.getPreviewImageData(root, volume, chapter, page);

		const mediaRoot = MediaRoots.get(root)!;
		const [volumeNumber, chapterNumber, pageNumber] = mediaRoot.getNumbers(volume, chapter, page);

		return new ImageButton(mediaRoot.getPath("raw", volume, chapter, page))
			.setText(() => type === "root" ? mediaRoot.name || path.basename(root) :
				type === "volume" ? new Translation(type!).get(volumeNumber) :
					type === "chapter" ? new Translation(type!).get(chapterNumber) :
						new Translation(type!).get(pageNumber))
			.append(!missingTranslations ? undefined : new Component()
				.classes.add("missing-translations")
				.setText(() => missingTranslations)
				.schedule(Tooltip.register, tooltip => tooltip
					.setText("missing-translations")))
			.appendTo(this.explorerWrapper);
	}

	private getPreviewImageData (root: string, volume?: number, chapter?: number, page?: number) {
		let type: "root" | "volume" | "chapter" | "page" | undefined;
		const mediaRoot = MediaRoots.get(root)!;
		if (volume === undefined) type = type || "root", [volume] = mediaRoot.volumes.indexedEntries().first()!;

		const chapters = mediaRoot.volumes.getByIndex(volume)!;
		if (chapter === undefined) type = type || "volume", [chapter] = chapters.indexedEntries().first()!;

		if (page === undefined) type = type || "chapter", page = 0;

		type = type || "page";

		return tuple(type, volume, chapter, page);
	}

	private getMissingTranslations (root: string, volume?: number, chapter?: number, page?: number): Stream<CaptureData> {
		const mediaRoot = MediaRoots.get(root)!;
		if (volume === undefined)
			return mediaRoot.volumes.indices()
				.flatMap(v => this.getMissingTranslations(root, v));

		const chapters = mediaRoot.volumes.getByIndex(volume)!;
		if (chapter === undefined)
			return chapters.indices()
				.flatMap(c => this.getMissingTranslations(root, volume, c));

		const pages = chapters.getByIndex(chapter)!;
		if (page === undefined)
			return pages.stream()
				.flatMap(p => p.captures.getMissingTranslations());

		return pages[page].captures.getMissingTranslations();
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

	@Bound private async addRoot () {
		const root = await Options.chooseFolder("prompt-root-folder");
		if (root) {
			options.rootFolders.push(root);
			await MediaRoots.addRoot(root);
			this.addRootButton(root);
		}
	}

	@Bound private onSettings () {
		new GlobalSettings();
	}

	@Bound private onRootSettings (root: string) {
		return async (event: Event) => {
			event.stopPropagation();

			const rootSettings = new RootSettings(root);
			await rootSettings.listeners.waitFor("remove");

			if (rootSettings.wasFileStructureChanged()) {
				await MediaRoots.get(root)!.load();
				this.showRoots();
				return;
			}

			const rootSettingsButton = Component.get(event).ancestors<ImageButton>(".root-button").first()!;

			if (!MediaRoots.has(root)) rootSettingsButton.remove();
			else rootSettingsButton.title.refreshText();
		};
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
}

class ImageButton extends Component {
	public readonly title = new Component()
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
		this.style.set("--preview", `url("${this.imagePath.replace(/\\/g, "/")}")`);
	}
}

// regexes for converting old dialog.md to importable dialog.md
// \n\-(?!--)(?:\s*(.*?):(?!\/\/))?\s*(.*?)(?=\n)
// replace: \n| $1 | $2 |
// ([^\|])(\n\|)
// replace: $1\n| Text | Note |\n| --- | --- |$2
// \[Page.*?raw/(\d+).png\)\n---
// replace: # Page $1
