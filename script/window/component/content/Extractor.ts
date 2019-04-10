import Component from "component/Component";
import CharacterEditor from "component/content/character/CharacterEditor";
import Capture from "component/content/extractor/Capture";
import GlobalSettings from "component/content/GlobalSettings";
import Header from "component/header/Header";
import Dropdown from "component/shared/Dropdown";
import Interrupt from "component/shared/Interrupt";
import SortableList, { SortableListEvent } from "component/shared/SortableList";
import Captures, { CaptureData } from "data/Captures";
import { BasicCharacter } from "data/Characters";
import Dialog from "data/Dialog";
import Projects from "data/Projects";
import { tuple } from "util/Arrays";
import Canvas from "util/Canvas";
import ChildProcess from "util/ChildProcess";
import Enums from "util/Enums";
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

export default class Extractor extends Component {

	private static displayMode = DisplayMode.Translate;

	private readonly pageImage: Component;
	private readonly capturesWrapper: SortableList;
	private readonly displayModeDropdown: Dropdown<DisplayMode>;

	private captures: Captures;
	private captureStart: Vector;
	private captureEnd: Vector;
	private waitingForCapture?: [number, (value: [Vector, Vector]) => void];

	public constructor (private readonly volume: number, private readonly chapter: number, private readonly page: number, hasPreviousPage = true, hasNextPage = true) {
		super();
		this.setId("extractor");

		const project = Projects.current!;

		const [volumeNumber, chapterNumber, pageNumber] = project.getSegmentNumbers(volume, chapter, page);

		new Component()
			.classes.add("page-wrapper")
			.append(new Component()
				.append(this.pageImage = new Component("img")
					.hide(true)
					.listeners.add("load", () => {
						const image = this.pageImage.element<HTMLImageElement>();
						this.pageImage.style.set("--natural-width", `${image.naturalWidth}px`);
						this.pageImage.style.set("--natural-height", `${image.naturalHeight}px`);
						this.pageImage.show();
					})))
			.appendTo(this);

		this.setPageImage();

		new Component()
			.classes.add("extraction-drawer")
			.append(new Component()
				.classes.add("extraction-actions")
				.append(new Component("button")
					.setText("back")
					.listeners.add("click", () => this.emit("quit")))
				.append(new Component("button")
					.setText("previous-page")
					.setDisabled(!hasPreviousPage)
					.listeners.add("click", () => this.emit("previous")))
				.append(new Component("button")
					.setText("next-page")
					.setDisabled(!hasNextPage)
					.listeners.add("click", () => this.emit("next")))
				.append(this.displayModeDropdown = Dropdown.from(Enums.values(DisplayMode))
					.classes.add("float-right")
					.setTitle("display-mode")
					.listeners.add("select", this.changeDisplayMode))
				.append(new Component("button")
					.classes.add("float-right")
					.setText("export")
					.listeners.add("click", this.export)))
			.append(new Component()
				.classes.add("extraction-captures-wrapper")
				.append(this.capturesWrapper = new SortableList()
					.listeners.add(SortableListEvent.SortComplete, this.onSortComplete)
					.classes.add("extraction-captures")))
			.appendTo(this);

		Header.setTitle(() => new Translation("title").get({
			root: project.getDisplayName(),
			volume: `${volumeNumber}`,
			chapter: `${chapterNumber}`,
			page: `${pageNumber}`,
		}));
	}

	public async addCapture (capture: CaptureData) {
		if (capture.id === undefined) {
			capture.id = this.captures.captureId++;
		}

		const roots = {
			capture: this.getCapturePagePath(),
			character: Projects.current!.getPath("character"),
		};

		const captureComponent = new Capture(roots, capture)
			.listeners.add("capture-change", this.updateJSON)
			.listeners.add<MouseEvent>("mouseenter", this.mouseEnterCapture)
			.listeners.add("remove-capture", this.removeCapture)
			.appendTo(this.capturesWrapper);

		if (capture.position === undefined || capture.size === undefined) {
			const [position, size] = await this.waitForCapture(capture.id);
			capture.position = position;
			capture.size = size;
		}

		captureComponent.refreshImage();
	}

	@Bound public async updateJSON () {
		this.captures.captures = this.capturesWrapper.children<Capture>()
			.map(component => component.getData())
			.toArray();
	}

	public async initialize () {
		this.captures = await Projects.current!.getPage(this.volume, this.chapter, this.page).captures.load();

		for (const capture of this.captures.captures) {
			await this.addCapture(capture);
		}

		this.displayModeDropdown.select(Extractor.displayMode);

		this.pageImage.listeners.add("mousedown", this.mouseDown);

		Component.window.listeners.until(this.listeners.waitFor("remove"))
			.add("keyup", this.keyup, true);
		Component.window.listeners.until(this.listeners.waitFor("remove"))
			.add("mousewheel", this.scroll, true);

		return this;
	}

	@Bound private onSortComplete () {
		this.mouseLeaveCapture();
		this.updateJSON();
	}

	@Bound private async removeCapture (event: Event) {
		const component = Component.get<Capture>(event);
		const capture = component.getData();

		const confirm = await Interrupt.confirm(interrupt => interrupt
			.setTitle("confirm-remove-capture")
			.setDescription(() => new Translation("confirm-remove-capture-description").get(capture.translation.replace(/\n/g, ""), capture.text.replace(/\n/g, ""))));

		if (!confirm) return;

		component.remove();
		FileSystem.unlink(`${this.getCapturePagePath()}/cap${pad(capture.id!, 3)}.png`);

		// we were just hovering over a capture, but now it's gone, so the "leave" event will never fire
		this.classes.remove("selecting");
		this.updateJSON();
	}

	@Bound private keyup (event: KeyboardEvent) {
		if (document.querySelector(".interrupt:not(.hidden), .dropdown-wrapper:not(.transparent)")) return;

		if (event.code === "Equal" && event.ctrlKey) this.zoomIn();
		else if (event.code === "Minus" && event.ctrlKey) this.zoomOut();
		else if (event.code === "Escape") this.emit("quit");
	}

	@Bound private scroll (event: WheelEvent) {
		if (!event.ctrlKey) return;

		if (event.deltaY > 0) this.zoomOut();
		else this.zoomIn();
	}

	private zoomIn () {
		const zoom = +this.pageImage.style.get("--zoom");
		this.pageImage.style.set("--zoom", Math.min(1, zoom + 0.1));
	}

	private zoomOut () {
		const zoom = +this.pageImage.style.get("--zoom");
		this.pageImage.style.set("--zoom", Math.max(0, zoom - 0.1));
	}

	@Bound private mouseEnterCapture (eventOrCaptureComponent: MouseEvent | Capture) {
		const component = eventOrCaptureComponent instanceof Capture ? eventOrCaptureComponent :
			Component.get<Capture>(eventOrCaptureComponent).listeners.add<MouseEvent>("mouseleave", this.mouseLeaveCapture);

		this.classes.add("selecting");

		const scale = this.pageImage.box().size().over(Vector.getNaturalSize(this.pageImage.element<HTMLImageElement>()));

		const capture = component.getData();
		const position = new Vector(capture.position || 0).times(scale);
		const size = new Vector(capture.size || 0).times(scale);

		this.style.set("--capture-x", position.x + this.pageImage.box().left);
		this.style.set("--capture-y", position.y + this.pageImage.box().top);
		this.style.set("--capture-w", size.x);
		this.style.set("--capture-h", size.y);
	}

	@Bound private mouseLeaveCapture (event?: MouseEvent) {
		if (event) Component.get(event).listeners.remove<MouseEvent>("mouseleave", this.mouseLeaveCapture);
		this.classes.remove("selecting");

		if (this.capturesWrapper.isSorting) {
			this.capturesWrapper.descendants<Capture>(".sorting")
				.first()!
				.schedule(this.mouseEnterCapture);
		}
	}

	@Bound private async mouseDown (event: MouseEvent) {
		if (!options.capture2TextCLIPath) {
			if (!await Interrupt.confirm(interrupt => interrupt
				.setTitle("no-capture2text-prompt")
				.setDescription("no-capture2text-prompt-description")))
				return;

			new GlobalSettings();
			return;
		}

		this.captureStart = Vector.get(event);

		Component.window.listeners.add("mousemove", this.mouseMove);
		Component.window.listeners.add("mouseup", this.mouseUp);
	}

	@Bound private mouseMove (event: MouseEvent) {
		this.captureEnd = Vector.get(event);
		this.classes.add("selecting");

		const position = Vector.min(this.captureStart, this.captureEnd);
		let size = Vector.size(this.captureStart, this.captureEnd);

		if (event.altKey) size = new Vector(Math.min(size.x, size.y));

		this.style.set("--capture-x", position.x);
		this.style.set("--capture-y", position.y);
		this.style.set("--capture-w", size.x);
		this.style.set("--capture-h", size.y);
	}

	@Bound private async mouseUp (event: MouseEvent) {
		this.mouseMove(event);
		this.classes.remove("selecting");

		Component.window.listeners.remove("mousemove", this.mouseMove);
		Component.window.listeners.remove("mouseup", this.mouseUp);

		const scale = this.pageImage.box().size().over(Vector.getNaturalSize(this.pageImage.element<HTMLImageElement>()));

		const size = Vector.size(this.captureStart, this.captureEnd).over(scale);
		if (size.x < 20 || size.y < 20) {
			return;
		}

		const position = Vector.min(this.captureStart, this.captureEnd).minus(this.pageImage.box().position()).over(scale);

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

			textarea.value = await this.saveCapture("temp.png", canvas, size);

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

		const [character, text] = await Promise.all([
			CharacterEditor.chooseCharacter(),
			this.saveCapture(`cap${pad(this.captures.captureId, 3)}.png`, canvas, size),
		]);

		await this.addCapture({
			position: position.raw(),
			size: size.raw(),
			text,
			translation: "",
			notes: [],
			character,
		});

		await this.updateJSON();
	}

	@Bound private changeDisplayMode (event: Event) {
		const dropdown = Component.get<Dropdown<DisplayMode>>(event);
		Extractor.displayMode = dropdown.getSelected();

		const readMode = Extractor.displayMode === DisplayMode.Read || Extractor.displayMode === DisplayMode.Translated;
		this.classes.toggle(readMode, "display-mode-read");

		if (readMode) {
			let lastCharacter: number | BasicCharacter | undefined;
			for (const capture of this.capturesWrapper.children<Capture>()) {
				const thisCharacter = capture.getData().character;
				capture.classes.toggle(thisCharacter === lastCharacter, "repeat-character");
				lastCharacter = thisCharacter;
			}
		}

		// if (Extractor.displayMode === DisplayMode.Translate) {
		// 	for (const textarea of this.capturesWrapper.descendants<Textarea>(".textarea")) {
		// 		textarea.setHeight();
		// 	}
		// }

		this.setPageImage();
	}

	private async setPageImage () {
		const project = Projects.current!;
		const translated = Extractor.displayMode === DisplayMode.Translated;
		const translatedPath = project.getPath(translated ? "translated" : "raw", this.volume, this.chapter, this.page);

		this.pageImage.parent!.classes.add("loading");

		if (translated && !await FileSystem.exists(translatedPath)) {
			const savePath = project.getPath("save", this.volume, this.chapter, this.page);
			if (await FileSystem.exists(savePath)) {
				if (!options.imageMagickCLIPath) {
					if (!await Interrupt.confirm(interrupt => interrupt
						.setTitle("prompt-imagemagick-for-viewing-psd")
						.setDescription("prompt-imagemagick-for-viewing-psd-description"))) return;

					await new GlobalSettings().listeners.waitFor("remove");
					if (!options.imageMagickCLIPath) return;
				}

				await FileSystem.mkdir(Path.dirname(translatedPath));
				await ChildProcess.exec(`"${options.imageMagickCLIPath}" "${savePath}[0]" "${translatedPath}"`);
			}
		}

		this.pageImage.attributes.set("src", translatedPath);
		this.pageImage.parent!.classes.remove("loading");
	}

	@Bound private async export () {
		await Dialog.export(this.volume, this.chapter, this.page);
	}

	private async saveImage (capturePath: string, canvas: HTMLCanvasElement) {
		const filename = `${this.getCapturePagePath()}/${capturePath}`;
		await Canvas.saveToFile(filename, canvas);
		return filename;
	}

	private async saveCapture (capturePath: string, canvas: HTMLCanvasElement, size: Vector) {
		capturePath = await this.saveImage(capturePath, canvas);

		const vertical = size.x < size.y;

		const [out] = await ChildProcess.exec(`"${options.capture2TextCLIPath}" --language Japanese --image "${capturePath}" --line-breaks${vertical ? " --vertical" : ""}`);
		return out.toString("utf8").trim();
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
