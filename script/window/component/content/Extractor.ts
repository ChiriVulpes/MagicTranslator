import Component from "component/Component";
import CharacterEditor from "component/content/character/CharacterEditor";
import Capture from "component/content/extractor/Capture";
import GlobalSettings from "component/content/GlobalSettings";
import Button from "component/shared/Button";
import ButtonBar from "component/shared/ButtonBar";
import Dropdown from "component/shared/Dropdown";
import Img from "component/shared/Img";
import Interrupt from "component/shared/Interrupt";
import SortableTiles from "component/shared/SortableTiles";
import type Captures from "data/Captures";
import type { CaptureData } from "data/Captures";
import type { BasicCharacter } from "data/Characters";
import Dialog from "data/Dialog";
import Projects from "data/Projects";
import Options from "Options";
import { tuple } from "util/Arrays";
import Canvas from "util/Canvas";
import ChildProcess from "util/ChildProcess";
import Enums from "util/Enums";
import type { Events, IEventEmitter } from "util/EventEmitter";
import FileSystem from "util/FileSystem";
import { Vector } from "util/math/Geometry";
import Path from "util/string/Path";
import { pad } from "util/string/String";
import Translation from "util/string/Translation";

enum DisplayMode {
	Translate = "translation-mode",
	Read = "read-mode",
	Translated = "translated-mode",
}

interface ExtractorEvents extends Events<Component> {
	quit (): any;
	previous (): any;
	next (): any;
}

export default class Extractor extends Component {

	private static displayMode = DisplayMode.Translate;

	declare event: IEventEmitter<this, ExtractorEvents>;

	private readonly pageImage: Img;
	private readonly capturesWrapper: SortableTiles<Capture>;
	private readonly displayModeDropdown: Dropdown<DisplayMode>;

	private captures: Captures;
	private captureStart: Vector;
	private captureEnd: Vector;
	private waitingForCapture?: [number, (value: [Vector, Vector]) => void];

	// tslint:disable-next-line cyclomatic-complexity
	public constructor (private readonly volume: number, private readonly chapter: number, private readonly page: number) {
		super();
		this.setId("extractor");

		const project = Projects.current!;

		let imageErrorWrapper: Component;

		new Component()
			.classes.add("page-wrapper")
			.append(new Component()
				.append(this.pageImage = new Img()
					.setAlt("no-translated-image")
					.event.subscribe("load", () => {
						imageErrorWrapper!.hide();
						const image = this.pageImage.element<HTMLImageElement>();
						this.style.set("--natural-width", `${image.naturalWidth}`);
						this.style.set("--natural-height", `${image.naturalHeight}`);
					})
					.event.subscribe("error", () => imageErrorWrapper!.show())))
			.append(imageErrorWrapper = new Component()
				.classes.add("extractor-prompt-imagemagick")
				.hide()
				.append(new Component()
					.setText("prompt-select-imagemagick"))
				.append(new Button()
					.setText("prompt-select-imagemagick-button")
					.event.subscribe("click", async () => {
						await new GlobalSettings().event.waitFor("remove");
						await this.setPageImage();
					})))
			.appendTo(this);

		void this.setPageImage();

		new Component()
			.classes.add("extraction-drawer")
			.append(new ButtonBar()
				.classes.add("extraction-actions")
				.append(new Button()
					.setIcon("\uE012")
					.setText("back")
					.event.subscribe("click", () => this.event.emit("quit")))
				.append(new Button()
					.setIcon("\uE100")
					.setText(page > 0 ? "prev-page"
						: chapter > 0 ? "prev-chapter"
							: volume > 0 ? "prev-volume"
								: "prev-page")
					.setDisabled(page <= 0 && chapter <= 0 && volume <= 0)
					.event.subscribe("click", () => this.event.emit("previous")))
				.append(new Button()
					.setIcon("\uE101")
					.setText(page < project.volumes.getByIndex(volume)!.getByIndex(chapter)!.length - 1 ? "next-page"
						: chapter < project.volumes.getByIndex(volume)!.size - 1 ? "next-chapter"
							: volume < project.volumes.size - 1 ? "next-volume"
								: "next-page")
					.setDisabled(page >= project.volumes.getByIndex(volume)!.getByIndex(chapter)!.length - 1
						&& chapter >= project.volumes.getByIndex(volume)!.size - 1
						&& volume >= project.volumes.size - 1)
					.event.subscribe("click", () => this.event.emit("next")))
				.append(this.displayModeDropdown = Dropdown.from(Enums.values(DisplayMode))
					.classes.add("float-right")
					.event.subscribe("select", this.changeDisplayMode))
				.append(new Button()
					.setIcon("\uE70F")
					.classes.add("float-right")
					.setText("open")
					.event.subscribe("click", this.openInExternalEditor))
				.append(new Button()
					.setIcon("\uE11C")
					.classes.add("float-right")
					.setText("export")
					.event.subscribe("click", this.export)))
			.append(new Component()
				.classes.add("extraction-captures-wrapper")
				.append(this.capturesWrapper = new SortableTiles<Capture>("vertical")
					.classes.add("loading", "extraction-captures")
					.event.subscribe("sort", this.onSortComplete)))
			.appendTo(this);
	}

	public async addCapture (capture: CaptureData) {
		if (capture.id === undefined) {
			capture.id = this.captures.captureId++;
		}

		const captureComponent = new Capture(this.getCapturePagePath(), capture)
			.event.subscribe("captureChange", this.updateJSON)
			.event.subscribe("removeCapture", this.removeCapture)
			.listeners.add<MouseEvent>("mouseenter", this.mouseEnterCapture)
			.schedule(this.capturesWrapper.addTile);

		if (capture.position === undefined || capture.size === undefined) {
			const [position, size] = await this.waitForCapture(capture.id);
			capture.position = position;
			capture.size = size;
		}

		captureComponent.refreshImage();
	}

	@Bound public updateJSON () {
		if (this.isRemoved) return;
		this.captures.captures = this.capturesWrapper.tiles()
			.map(component => component.getData())
			.toArray();
	}

	private getImgDimensions (path: string) {
		return new Promise<Vector | undefined>((resolve, reject) => {
			const img = document.createElement("img");
			img.onload = () => resolve(Vector.getNaturalSize(img));
			img.onerror = () => resolve(undefined);
			img.src = path;
		});
	}

	public async initialize () {
		this.captures = await Projects.current!.getPage(this.volume, this.chapter, this.page).captures.load();
		this.captures.rawSize ??= await this.getImgDimensions(Projects.current!.getPath("raw", this.volume, this.chapter, this.page));

		for (const capture of this.captures.captures) {
			await this.addCapture(capture);
		}

		this.displayModeDropdown.select(Extractor.displayMode);

		this.pageImage.listeners.add("mousedown", this.mouseDown);

		Component.window.listeners.until(this.event.waitFor("remove"))
			.add("keyup", this.keyup, true);
		Component.window.listeners.until(this.event.waitFor("remove"))
			.add("mousewheel", this.scroll, true);

		this.capturesWrapper.classes.remove("loading");

		return this;
	}

	@Bound private onSortComplete () {
		this.mouseLeaveCapture();
		this.updateJSON();
		this.updateRepeatedCharacters();
	}

	@Bound private async removeCapture (component: Capture, activeTextarea?: "source" | "translation") {
		const captures = [...this.capturesWrapper.tiles()];
		const index = captures.indexOf(component);
		captures.splice(index, 1);

		const capture = component.getData();

		const confirm = await Interrupt.remove(interrupt => interrupt
			.setTitle("confirm-remove-capture")
			.setDescription(() => new Translation("confirm-remove-capture-description").get(capture.translation.replace(/\n/g, ""), capture.text.replace(/\n/g, ""))));

		if (!confirm) {
			component.focus(activeTextarea);
			return;
		}

		component.remove();
		await FileSystem.unlink(`${this.getCapturePagePath()}/cap${pad(capture.id!, 3)}.png`);

		(captures[index] ?? captures[index - 1])?.focus(activeTextarea);

		// we were just hovering over a capture, but now it's gone, so the "leave" event will never fire
		this.classes.remove("selecting");
		this.updateJSON();
	}

	@Bound private keyup (event: KeyboardEvent) {
		if (document.querySelector(".interrupt:not(.hidden), .dropdown-wrapper:not(.transparent)")) return;

		if (event.code === "Equal" && event.ctrlKey) this.zoomIn();
		else if (event.code === "Minus" && event.ctrlKey) this.zoomOut();
		else if (event.code === "Escape") this.event.emit("quit");
	}

	@Bound private scroll (event: WheelEvent) {
		if (!event.ctrlKey) return;

		if (event.deltaY > 0) this.zoomOut();
		else this.zoomIn();
	}

	private zoomIn () {
		const zoom = +this.pageImage.style.get("--zoom");
		this.pageImage.style.set("--zoom", Math.min(1, zoom + 0.1));
		this.mouseEnterCapture();
	}

	private zoomOut () {
		const zoom = +this.pageImage.style.get("--zoom");
		this.pageImage.style.set("--zoom", Math.max(0, zoom - 0.1));
		this.mouseEnterCapture();
	}

	private scaleCaptureHighlightForRendering (capture: CaptureData): [position: Vector, size: Vector] {
		const naturalSize = Vector.getNaturalSize(this.pageImage.element<HTMLImageElement>());
		const userZoom = this.pageImage.box().size().over(naturalSize);

		const version = capture.version ?? 1;
		const naturalScale = naturalSize
			.over(version === 1 ? this.captures.rawSize ?? naturalSize : 1)
			.times(userZoom);

		const position = new Vector(capture.position || 0).times(naturalScale);
		const size = new Vector(capture.size || 0).times(naturalScale);

		return [position, size];
	}

	private mouseCapture?: Capture;
	@Bound private mouseEnterCapture (eventOrCaptureComponent: MouseEvent | Capture | undefined = this.mouseCapture) {
		if (!eventOrCaptureComponent)
			return;

		const component = eventOrCaptureComponent instanceof Capture ? eventOrCaptureComponent :
			Component.get<Capture>(eventOrCaptureComponent).listeners.add<MouseEvent>("mouseleave", this.mouseLeaveCapture);

		this.classes.add("selecting");
		this.mouseCapture = component;

		const capture = component.getData();
		const [position, size] = this.scaleCaptureHighlightForRendering(capture);

		this.style.set("--capture-offset-x", this.pageImage.box().left);
		this.style.set("--capture-offset-y", this.pageImage.box().top);
		this.style.set("--capture-x", position.x);
		this.style.set("--capture-y", position.y);
		this.style.set("--capture-w", size.x);
		this.style.set("--capture-h", size.y);
	}

	@Bound private mouseLeaveCapture (event?: MouseEvent) {
		if (event) Component.get(event).listeners.remove<MouseEvent>("mouseleave", this.mouseLeaveCapture);
		this.classes.remove("selecting");

		delete this.mouseCapture;

		if (this.capturesWrapper.isSorting()) {
			this.capturesWrapper.descendants<Capture>(".moving > .capture")
				.first()!
				.schedule(this.mouseEnterCapture);
		}
	}

	@Bound private async mouseDown (event: MouseEvent) {
		if (event.button !== 0) return;

		if (!options.getCaptor()) {
			if (!await Interrupt.confirm(interrupt => interrupt
				.setTitle("no-ocr-application-confirm")
				.setDescription("no-ocr-application-confirm-description")))
				return;

			new GlobalSettings();
			return;
		}

		this.captureStart = Vector.get(event);
		this.style.set("--capture-offset-x", this.pageImage.box().left);
		this.style.set("--capture-offset-y", this.pageImage.box().top);

		Component.window.listeners.add("mousemove", this.mouseMove);
		Component.window.listeners.add("mouseup", this.mouseUp);
	}

	@Bound private mouseMove (event: MouseEvent) {
		this.captureEnd = Vector.get(event);
		this.classes.add("selecting");

		const position = Vector.min(this.captureStart, this.captureEnd);
		let size = Vector.size(this.captureStart, this.captureEnd);

		if (event.altKey) size = new Vector(Math.min(size.x, size.y));

		this.style.set("--capture-x", position.x - this.pageImage.box().left);
		this.style.set("--capture-y", position.y - this.pageImage.box().top);
		this.style.set("--capture-w", size.x);
		this.style.set("--capture-h", size.y);
	}

	@Bound private async mouseUp (event: MouseEvent) {
		this.mouseMove(event);
		this.classes.remove("selecting");

		Component.window.listeners.remove("mousemove", this.mouseMove);
		Component.window.listeners.remove("mouseup", this.mouseUp);

		const naturalSize = Vector.getNaturalSize(this.pageImage.element<HTMLImageElement>());
		const scale = this.pageImage.box().size().over(naturalSize);

		const rawTopLeft = Vector.min(this.captureStart, this.captureEnd).minus(this.pageImage.box().position()).over(scale);
		const rawBottomRight = Vector.max(this.captureStart, this.captureEnd).minus(this.pageImage.box().position()).over(scale);

		const position = Vector.max(Vector.ZERO, rawTopLeft);
		const bottomRight = Vector.min(naturalSize, rawBottomRight);

		const size = Vector.size(position, bottomRight);
		if (size.x < 20 || size.y < 20) {
			return;
		}

		const canvas = document.createElement("canvas");
		if (event.altKey) {
			canvas.width = canvas.height = Math.min(size.x, size.y);

		} else {
			canvas.width = size.x;
			canvas.height = size.y;
		}

		const context = canvas.getContext("2d")!;

		context.drawImage(this.pageImage.element<HTMLImageElement>(), -position.x, -position.y);

		if (this.waitingForCapture) {
			const [captureId, resolve] = this.waitingForCapture;
			await this.saveCapture(`cap${pad(captureId, 3)}.png`, canvas, size);
			resolve(tuple(position, size));
			delete this.waitingForCapture;
			return;
		}

		if (event.ctrlKey) {
			const textarea = document.createElement("textarea");
			textarea.style.setProperty("position", "fixed");
			textarea.style.setProperty("opacity", "0");
			document.body.appendChild(textarea);

			textarea.value = (await this.saveCapture("temp.png", canvas, size))!;

			textarea.select();
			document.execCommand("copy");
			textarea.remove();

			await FileSystem.unlink(`${this.getCapturePagePath()}/temp.png`);

			return;
		}

		if (event.altKey) {
			const path = await this.saveImage("temp.png", canvas);

			await CharacterEditor.createCharacter(path);

			await FileSystem.unlink(path);

			return;
		}

		const character = await CharacterEditor.chooseCharacter(-1);
		if (character === -1)
			// cancel
			return;

		const text = await this.saveCapture(`cap${pad(this.captures.captureId, 3)}.png`, canvas, size);

		await this.addCapture({
			version: 2,
			position: position.over(naturalSize).raw(),
			size: size.over(naturalSize).raw(),
			text: text!,
			translation: "",
			notes: [],
			character,
		});

		await this.updateJSON();
	}

	@Bound private changeDisplayMode (dropdown: Dropdown<DisplayMode>) {
		Extractor.displayMode = dropdown.getSelected();

		const readMode = Extractor.displayMode === DisplayMode.Read || Extractor.displayMode === DisplayMode.Translated;
		this.classes.toggle(readMode, "display-mode-read");
		this.updateRepeatedCharacters();

		// if (Extractor.displayMode === DisplayMode.Translate) {
		// 	for (const textarea of this.capturesWrapper.descendants<Textarea>(".textarea")) {
		// 		textarea.setHeight();
		// 	}
		// }

		void this.setPageImage();
	}

	private updateRepeatedCharacters () {
		let lastCharacter: number | BasicCharacter | undefined;
		for (const capture of this.capturesWrapper.tiles()) {
			const thisCharacter = capture.getData().character;
			capture.classes.toggle(thisCharacter === lastCharacter, "repeat-character");
			lastCharacter = thisCharacter;
		}
	}

	private async setPageImage () {
		const project = Projects.current!;
		const translated = Extractor.displayMode === DisplayMode.Translated;
		const translatedPath = project.getPath(translated ? "translated" : "raw", this.volume, this.chapter, this.page);

		this.pageImage.parent!.classes.add("loading");

		if (translated) await this.initializePageImage(translatedPath);

		this.pageImage.setSrc(`${translatedPath}?cachebuster${Math.random()}`);
		this.pageImage.parent!.classes.remove("loading");
	}

	private async initializePageImage (translatedPath: string) {
		const project = Projects.current!;
		const savePath = project.getPath("save", this.volume, this.chapter, this.page);
		const [translatedStats, saveStats] = await Promise.all([FileSystem.stat(translatedPath), FileSystem.stat(savePath)]);
		if (saveStats && (!translatedStats || translatedStats.mtime.getTime() < saveStats.mtime.getTime())) {
			if (!options.imageMagickCLIPath)
				return;

			await FileSystem.mkdir(Path.dirname(translatedPath));
			await ChildProcess.exec(`"${options.imageMagickCLIPath}" "${savePath}[0]" "${translatedPath}"`)
				.catch(async err => Interrupt.info(screen => screen
					.setTitle("imagemagick-unsupported")
					// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
					.setDescription(() => err.message.replace(/^Command failed: .*?\n/, ""))));
		}
	}

	@Bound private async export () {
		await Dialog.export(this.volume, this.chapter, this.page);
	}

	@Bound private async openInExternalEditor () {
		const project = Projects.current!;
		if (!project.externalEditorCLIPath && !options.externalEditorCLIPath) {
			const confirm = await Interrupt.confirm(interrupt => interrupt
				.setTitle("confirm-no-external-editor")
				.setDescription("confirm-no-external-editor-description"));
			if (!confirm) return;

			await Options.chooseExternalEditorCLIPath();
		}

		let path = project.getPath("save", this.volume, this.chapter, this.page);
		if (!await FileSystem.exists(path)) path = project.getPath("raw", this.volume, this.chapter, this.page);

		// we ignore the result of this cuz we don't want errors in opening the program to crash here or something
		void ChildProcess.exec(`"${project.externalEditorCLIPath || options.externalEditorCLIPath}" "${path}"`);
	}

	private async saveImage (capturePath: string, canvas: HTMLCanvasElement) {
		const filename = `${this.getCapturePagePath()}/${capturePath}`;
		await Canvas.saveToFile(filename, canvas);
		return filename;
	}

	private async saveCapture (capturePath: string, canvas: HTMLCanvasElement, size: Vector) {
		capturePath = await this.saveImage(capturePath, canvas);

		const vertical = size.x < size.y;

		const captor = options.getCaptor();
		return captor && captor.capture(capturePath, vertical);
	}

	private async waitForCapture (id: number) {
		this.classes.add("waiting-for-capture");
		return new Promise<[Vector, Vector]>(resolve => {
			this.waitingForCapture = tuple(id, (captureData: [Vector, Vector]) => {
				resolve(captureData);
				this.classes.remove("waiting-for-capture");
			});
		});
	}

	private getCapturePagePath () {
		return Projects.current!.getPath("capture", this.volume, this.chapter, this.page);
	}
}
