import Component, { TextGenerator } from "component/Component";
import GlobalSettings from "component/content/GlobalSettings";
import ProjectSettings from "component/content/ProjectSettings";
import Header from "component/header/Header";
import Button from "component/shared/Button";
import ButtonBar from "component/shared/ButtonBar";
import SortableTiles from "component/shared/SortableTiles";
import Tooltip from "component/shared/Tooltip";
import { CaptureData } from "data/Captures";
import Dialog from "data/Dialog";
import Projects, { PagePathSegment, Project } from "data/Projects";
import Options from "Options";
import { tuple } from "util/Arrays";
import { sleep } from "util/Async";
import Stream from "util/stream/Stream";
import Translation from "util/string/Translation";

export default class Explorer extends Component {
	private readonly explorerWrapper: Component;
	private readonly actionWrapper = new ButtonBar().appendTo(this);
	private projects: SortableTiles<ImageButton>;

	public constructor (private readonly startLocation?: [string, number?, number?]) {
		super();
		this.setId("explorer");

		new Component()
			.classes.add("explorer-wrapper")
			.append(this.explorerWrapper = new Component()
				.classes.add("explorer-links"))
			.appendTo(this);

		this.initialize();
	}

	private async initialize () {

		if (!this.startLocation) {
			Projects.current = undefined;
			this.showProjects();
			return;
		}

		const [root, volume, chapter] = this.startLocation;

		if (volume === undefined) return this.showVolumes(root);
		Projects.current = Projects.get(root);

		if (chapter === undefined) return this.showChapters(volume);

		return this.showPages(volume, chapter);
	}

	@Bound private showProjects () {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();
		this.projects = new SortableTiles<ImageButton>()
			.listeners.add("sort", this.onSortProjects)
			.appendTo(this.explorerWrapper);

		Projects.keys().forEach(this.addProjectButton);

		new Button()
			.setIcon("\uE109")
			.setText("add-project")
			.listeners.add("click", this.addProject)
			.appendTo(this.actionWrapper);

		new Button()
			.setIcon("\uE115")
			.classes.add("float-right")
			.setText("app-settings")
			.listeners.add("click", this.onSettings)
			.appendTo(this.actionWrapper);

		Header.setBreadcrumbs(["title"]);
	}

	private async showVolumes (root: string) {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		this.addBackButton(this.showProjects);

		new Button()
			.setIcon("\uE115")
			.classes.add("float-right")
			.setText("project-settings")
			.listeners.add("click", this.onProjectSettings(root))
			.appendTo(this.actionWrapper);

		const project = Projects.current = Projects.get(root)!;

		// Dropdown.from(mediaRoot.users)
		// 	.classes.add("float-right")
		// 	.appendTo(this.actionWrapper);

		for (const [volumeIndex] of project.volumes.indexedEntries()) {
			this.addImageButton(volumeIndex)
				.listeners.add("click", () => this.showChapters(volumeIndex));
		}

		Header.setBreadcrumbs(
			["title", this.showProjects],
			[() => new Translation("project").get(project.getDisplayName())],
		);
	}

	private showChapters (volume: number) {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		const project = Projects.current!;

		this.addBackButton(() => this.showVolumes(project.root));

		new Button()
			.setIcon("\uE100")
			.setDisabled(volume === 0)
			.setText("prev-volume")
			.listeners.add("click", () => this.showChapters(volume - 1))
			.appendTo(this.actionWrapper);

		new Button()
			.setIcon("\uE101")
			.setDisabled(volume === project.volumes.size - 1)
			.setText("next-volume")
			.listeners.add("click", () => this.showChapters(volume + 1))
			.appendTo(this.actionWrapper);

		const chapters = project.volumes.getByIndex(volume)!;

		for (const [index] of chapters.indexedEntries()) {
			this.addImageButton(volume, index)
				.listeners.add("click", () => this.showPages(volume, index));
		}

		const [volumeNumber] = project.getSegmentNumbers(volume);
		Header.setBreadcrumbs(
			["title", this.showProjects],
			[() => new Translation("project").get(project.getDisplayName()), () => this.showVolumes(project.root)],
			[() => new Translation("volume").get(volumeNumber)],
		);
	}

	private async showPages (volume: number, chapter: number) {
		this.actionWrapper.dump();
		this.explorerWrapper.dump();

		this.addBackButton(() => this.showChapters(volume));

		const project = Projects.current!;
		const chapters = project.volumes.getByIndex(volume)!;

		new Button()
			.setIcon("\uE100")
			.setDisabled(chapter <= 0 && volume <= 0)
			.setText(chapter <= 0 ? "prev-volume" : "prev-chapter")
			.listeners.add("click", () => chapter > 0 ? this.showPages(volume, chapter - 1)
				: this.showPages(volume - 1, project.volumes.getByIndex(volume - 1)!.size - 1))
			.appendTo(this.actionWrapper);

		new Button()
			.setIcon("\uE101")
			.setDisabled(chapter >= chapters.size - 1 && volume >= project.volumes.size - 1)
			.setText(chapter >= chapters.size - 1 ? "next-volume" : "next-chapter")
			.listeners.add("click", () => chapter < chapters.size - 1 ? this.showPages(volume, chapter + 1)
				: this.showPages(volume + 1, 0))
			.appendTo(this.actionWrapper);

		new Button()
			.setIcon("\uE11C")
			.classes.add("float-right")
			.setText("export")
			.listeners.add("click", () => this.export(volume, chapter))
			.appendTo(this.actionWrapper);

		new Button()
			.setIcon("\uE118")
			.classes.add("float-right")
			.setText("import")
			.listeners.add("click", () => this.import(volume, chapter))
			.appendTo(this.actionWrapper);

		const pages = await project.volumes.getByIndex(volume)!.getByIndex(chapter)!;

		for (let i = 0; i < pages.length; i++) {
			this.addImageButton(volume, chapter, i)
				.listeners.add("click", () => this
					.emit<[number, number, number]>("extract", event => event
						.data = tuple(volume, chapter, i)));
		}

		const [volumeNumber, chapterNumber] = project.getSegmentNumbers(volume, chapter);
		Header.setBreadcrumbs(
			["title", this.showProjects],
			[() => new Translation("project").get(project.getDisplayName()), () => this.showVolumes(project.root)],
			[() => new Translation("volume").get(volumeNumber), () => this.showChapters(volume)],
			[() => new Translation("chapter").get(chapterNumber)],
		);
	}

	@Bound private addProjectButton (root: string) {
		return this.projects.addTile(this.addImageButton(root)
			.data.set("root", root)
			.classes.add("project-button")
			.listeners.add("click", () => this.showVolumes(root)));
	}

	private addImageButton (volume?: number, chapter?: number, page?: number): ImageButton;
	private addImageButton (root: string): ImageButton;
	private addImageButton (root?: string | number, volume?: number, chapter?: number, page?: number) {
		let project = Projects.current!;
		if (typeof root === "string") {
			project = Projects.get(root)!;
			volume = undefined;
		} else {
			page = chapter;
			chapter = volume;
			volume = root;
		}

		const missingTranslations = this.getMissingTranslations(project.root, volume, chapter, page).count();

		let type: "root" | PagePathSegment | undefined;
		[type, volume, chapter, page] = this.getPreviewImageData(project, volume, chapter, page);

		const [volumeNumber, chapterNumber, pageNumber] = project.getSegmentNumbers(volume, chapter, page);

		return new ImageButton(project.root, project.getPath("raw", volume, chapter, page))
			.setText(() => type === "root" ? project.getDisplayName() :
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

	private getPreviewImageData (project: Project, volume?: number, chapter?: number, page?: number) {
		let type: "root" | PagePathSegment | undefined;
		if (volume === undefined) type = type || "root", [volume] = project.volumes.indexedEntries().first()!;

		const chapters = project.volumes.getByIndex(volume)!;
		if (chapter === undefined) type = type || "volume", [chapter] = chapters.indexedEntries().first()!;

		if (page === undefined) type = type || "chapter", page = 0;

		type = type || "page";

		return tuple(type, volume, chapter, page);
	}

	private getMissingTranslations (root: string, volume?: number, chapter?: number, page?: number): Stream<CaptureData> {
		const project = Projects.get(root)!;
		if (volume === undefined)
			return project.volumes.indices()
				.flatMap(v => this.getMissingTranslations(root, v));

		const chapters = project.volumes.getByIndex(volume)!;
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
		new Button()
			.setIcon("\uE096")
			.setText("back")
			.listeners.add("click", handler)
			.appendTo(this.actionWrapper);

		Component.window.listeners.until(this.listeners.waitFor(["back", "remove"]))
			.add("keyup", this.keyup, true);

		this.listeners.until("back").add("back", () => sleep(0.001).then(handler));
	}

	@Bound private async addProject () {
		const root = await Options.chooseFolder("prompt-project-folder");
		if (root) {
			options.projectFolders.push(root);
			await Projects.addProject(root);
			this.addProjectButton(root);
		}
	}

	@Bound private onSettings () {
		new GlobalSettings();
	}

	@Bound private onProjectSettings (root: string) {
		return async (event: Event) => {
			event.stopPropagation();

			const projectSettings = new ProjectSettings(root);
			await projectSettings.listeners.waitFor("close");

			const project = Projects.get(root);

			if (projectSettings.wasFileStructureChanged() || !project) {
				this.showProjects();
				return;
			}

			if (project) Header.setBreadcrumbs(
				["title", this.showProjects],
				[() => new Translation("project").get(project.getDisplayName())],
			);
		};
	}

	@Bound private onSortProjects () {
		options.projectFolders = this.projects.tiles()
			.map(project => project.data.get("root")!)
			.toArray();
	}

	@Bound private async export (volume: number, chapter: number) {
		await Dialog.export(volume, chapter);
	}

	@Bound private async import (volume: number, chapter: number) {
		await Dialog.import(volume, chapter);
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

	public constructor (private readonly root: string, private readonly imagePath: string) {
		super("a");
		this.classes.add("image-button", "loading");
		this.attributes.set("href", "#");
		this.loadPreview();
	}

	@Override public setText (text?: TextGenerator<Component>) {
		super.setText(text);
		this.title.setText(text);
		return this;
	}

	@Override public refreshText () {
		this.title.refreshText();
		return this;
	}

	private async loadPreview () {
		this.listeners.waitFor("remove")
			.then(() => Projects.get(this.root)!.thumbs.cancel(this.imagePath));

		const thumbnail = await Projects.get(this.root)!.thumbs.get(this.imagePath);
		this.classes.remove("loading");
		this.style.set("--preview", `url("${thumbnail}")`);
	}
}

// regexes for converting old dialog.md to importable dialog.md
// \n\-(?!--)(?:\s*(.*?):(?!\/\/))?\s*(.*?)(?=\n)
// replace: \n| $1 | $2 |
// ([^\|])(\n\|)
// replace: $1\n| Text | Note |\n| --- | --- |$2
// \[Page.*?raw/(\d+).png\)\n---
// replace: # Page $1
