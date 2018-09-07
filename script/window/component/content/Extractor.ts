import Component from "component/Component";
import { BasicCharacter } from "component/content/character/Character";
import CharacterEditor from "component/content/character/CharacterEditor";
import Capture, { CaptureData } from "component/content/extractor/Capture";
import Header from "component/header/Header";
import SortableList, { SortableListEvent } from "component/shared/SortableList";
import Bound from "util/Bound";
import Collectors from "util/Collectors";
import File from "util/File";
import { Vector } from "util/math/Geometry";
import { pad } from "util/string/String";
import Translation from "util/string/Translation";

interface TranslationData {
	captureId: number;
	captures: CaptureData[];
}

export default class Extractor extends Component {
	private readonly pageImage: Component;
	private readonly capturesWrapper: SortableList;

	private captureId = 0;
	private captureStart: Vector;
	private captureEnd: Vector;

	public constructor(private readonly volume: string, private readonly chapter: string, private readonly page: string, hasPreviousPage = true, hasNextPage = true) {
		super();
		this.setId("extractor");

		new Component()
			.classes.add("page-wrapper")
			.append(new Component()
				.append(this.pageImage = new Component("img")
					.hide(true)
					.attributes.set("src", `${options.root}/${volume}/${chapter}/raw/${page}`)
					.listeners.add("load", () => {
						const image = this.pageImage.element<HTMLImageElement>();
						this.pageImage.style.set("--natural-width", `${image.naturalWidth}px`);
						this.pageImage.style.set("--natural-height", `${image.naturalHeight}px`);
						this.pageImage.show();
					})))
			.appendTo(this);

		new Component()
			.classes.add("extraction-drawer")
			.append(new Component()
				.classes.add("extraction-actions")
				.append(new Component("button")
					.setText("back")
					.listeners.add("click", () => this.emit("quit")))
				.append(new Component("button")
					.setText("previous-page")
					.classes.toggle(!hasPreviousPage, "disabled")
					.listeners.add("click", () => this.emit("previous")))
				.append(new Component("button")
					.setText("next-page")
					.classes.toggle(!hasNextPage, "disabled")
					.listeners.add("click", () => this.emit("next")))
				.append(new Component("button")
					.classes.add("float-right")
					.setText(() => new Translation(this.classes.has("display-mode-read") ? "translation-mode" : "read-mode").get())
					.listeners.add("click", this.readMode))
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

		Header.setTitle(() => new Translation("title").get({ volume: +volume.slice(3), chapter: +chapter.slice(2), page: parseInt(page) }));

		this.initialize();
	}

	private async initialize () {
		const jsonData = await fs.readFile(`${this.getCapturePagePath()}.json`, "utf8")
			.catch(() => { });

		const translationData: TranslationData = JSON.parse(jsonData || "{}");

		this.captureId = translationData.captureId || 0;

		for (const capture of translationData.captures || []) {
			this.addCapture(capture);
		}

		this.pageImage.listeners.add("mousedown", this.mouseDown);

		Component.window.listeners.until(this.listeners.waitFor("remove"))
			.add("keyup", this.keyup, true);
		Component.window.listeners.until(this.listeners.waitFor("remove"))
			.add("mousewheel", this.scroll, true);
	}

	@Bound
	private onSortComplete () {
		this.mouseLeaveCapture();
		this.updateJSON();
	}

	private addCapture (capture: CaptureData) {
		new Capture(this.getCapturePagePath(), capture)
			.listeners.add("capture-change", this.updateJSON)
			.listeners.add<MouseEvent>("mouseenter", this.mouseEnterCapture)
			.listeners.add("remove-capture", this.removeCapture)
			.appendTo(this.capturesWrapper);
	}

	@Bound
	private removeCapture (event: Event) {
		const component = Component.get<Capture>(event);
		component.remove();

		const capture = component.getData();
		fs.unlink(`${this.getCapturePagePath()}/cap${pad(capture.id, 3)}.png`);

		// we were just hovering over a capture, but now it's gone, so the "leave" event will never fire
		this.classes.remove("selecting");
		this.updateJSON();
	}

	@Bound
	private keyup (event: KeyboardEvent) {
		if (!Component.get("#character-editor").classes.has("hidden")) return;

		if (event.code === "Equal" && event.ctrlKey) this.zoomIn();
		else if (event.code === "Minus" && event.ctrlKey) this.zoomOut();
		else if (event.code === "Escape") this.emit("quit");
	}

	@Bound
	private scroll (event: WheelEvent) {
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

	@Bound
	private mouseEnterCapture (eventOrCaptureComponent: MouseEvent | Capture) {
		const component = eventOrCaptureComponent instanceof Capture ? eventOrCaptureComponent :
			Component.get<Capture>(eventOrCaptureComponent).listeners.add<MouseEvent>("mouseleave", this.mouseLeaveCapture);

		this.classes.add("selecting");

		const scale = this.pageImage.box().size().over(Vector.getNaturalSize(this.pageImage.element<HTMLImageElement>()));

		const capture = component.getData();
		const position = new Vector(capture.position).times(scale);
		const size = new Vector(capture.size).times(scale);

		this.style.set("--capture-x", position.x + this.pageImage.box().left);
		this.style.set("--capture-y", position.y + this.pageImage.box().top);
		this.style.set("--capture-w", size.x);
		this.style.set("--capture-h", size.y);
	}

	@Bound
	private mouseLeaveCapture (event?: MouseEvent) {
		if (event) Component.get(event).listeners.remove<MouseEvent>("mouseleave", this.mouseLeaveCapture);
		this.classes.remove("selecting");

		if (this.capturesWrapper.isSorting) {
			this.capturesWrapper.descendants<Capture>(".sorting")
				.first()!
				.schedule(this.mouseEnterCapture);
		}
	}

	@Bound
	private async updateJSON () {
		const translationData: TranslationData = {
			captureId: this.captureId,
			captures: this.capturesWrapper.children<Capture>()
				.map(component => component.getData())
				.collect(Collectors.toArray),
		};

		await fs.writeFile(`${options.root}/${this.volume}/${this.chapter}/capture/${this.page.slice(0, -4)}.json`, JSON.stringify(translationData));
	}

	@Bound
	private mouseDown (event: MouseEvent) {
		this.captureStart = Vector.get(event);

		Component.window.listeners.add("mousemove", this.mouseMove);
		Component.window.listeners.add("mouseup", this.mouseUp);
	}

	@Bound
	private mouseMove (event: MouseEvent) {
		this.captureEnd = Vector.get(event);
		this.classes.add("selecting");

		const position = Vector.min(this.captureStart, this.captureEnd);
		const size = Vector.size(this.captureStart, this.captureEnd);

		this.style.set("--capture-x", position.x);
		this.style.set("--capture-y", position.y);
		this.style.set("--capture-w", size.x);
		this.style.set("--capture-h", size.y);
	}

	@Bound
	private async mouseUp (event: MouseEvent) {
		this.mouseMove(event);
		this.classes.remove("selecting");

		Component.window.listeners.remove("mousemove", this.mouseMove);
		Component.window.listeners.remove("mouseup", this.mouseUp);

		const scale = this.pageImage.box().size().over(Vector.getNaturalSize(this.pageImage.element<HTMLImageElement>()));

		const size = Vector.size(this.captureStart, this.captureEnd).over(scale);
		if (size.x < 30 || size.y < 30) {
			return;
		}

		const position = Vector.min(this.captureStart, this.captureEnd).minus(this.pageImage.box().position()).over(scale);

		const canvas = document.createElement("canvas");
		canvas.width = size.x;
		canvas.height = size.y;
		const context = canvas.getContext("2d")!;

		context.drawImage(this.pageImage.element<HTMLImageElement>(), -position.x, -position.y);

		if (event.ctrlKey) {
			const textarea = document.createElement("textarea");
			textarea.style.setProperty("position", "fixed");
			textarea.style.setProperty("opacity", "0");
			document.body.appendChild(textarea);

			textarea.value = await this.saveCapture("temp.png", canvas, size);

			textarea.select();
			document.execCommand("copy");
			textarea.remove();

			await fs.unlink(`${this.getCapturePagePath()}/temp.png`);

			return;
		}

		const [character, text] = await Promise.all([
			CharacterEditor.chooseCharacter(),
			this.saveCapture(`cap${pad(this.captureId++, 3)}.png`, canvas, size),
		]);

		this.addCapture({
			id: this.captureId - 1,
			position: position.raw(),
			size: size.raw(),
			text,
			translation: "",
			notes: [],
			character,
		});

		await this.updateJSON();
	}

	@Bound
	private readMode (event: Event) {
		this.classes.toggle("display-mode-read");
		Component.get(event).refreshText();

		if (this.classes.has("display-mode-read")) {
			let lastCharacter: number | BasicCharacter | undefined;
			for (const capture of this.capturesWrapper.children<Capture>()) {
				const thisCharacter = capture.getData().character;
				capture.classes.toggle(thisCharacter === lastCharacter, "repeat-character");
				lastCharacter = thisCharacter;
			}
		}
	}

	@Bound
	private export () {
		let result = `Volume ${+this.volume.slice(3)}, Chapter ${+this.chapter.slice(2)}, Page ${+this.page.slice(0, -4)}\n\n`;

		let lastCharacter: number | BasicCharacter | undefined;
		for (const capture of this.capturesWrapper.children<Capture>()) {
			const data = capture.getData();
			if (data.character && data.character !== lastCharacter) {
				result += `## ${CharacterEditor.getName(data.character)}\n\n`;
				lastCharacter = data.character;
			}

			result += data.text.trim()
				.split(/\r?\n/)
				.map(line => "> " + line)
				.join("\n") + "\n\n";

			if (data.translation) result += data.translation + "\n\n";

			const notes = data.notes.filter(([f, n]) => f && n);
			if (notes.length) result += notes
				.map(([f, n]) => `- \`${f}\` — ${n}`)
				.join("\n") + "\n\n";
		}

		File.download(`dialog-${this.volume}-${this.chapter}-${this.page.slice(0, -4)}.md`, result);
	}

	private async saveCapture (path: string, canvas: HTMLCanvasElement, size: Vector) {
		const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve));

		const buffer = await new Promise<Buffer>(resolve => {
			const reader = new FileReader();
			reader.onload = async () => {
				if (reader.readyState === 2) {
					resolve(Buffer.from(reader.result as ArrayBuffer));
				}
			};
			reader.readAsArrayBuffer(blob!);
		});

		await fs.mkdir(`${options.root}/${this.volume}/${this.chapter}/capture`);
		await fs.mkdir(this.getCapturePagePath());

		const cropPath = `${this.getCapturePagePath()}/${path}`;
		await fs.writeFile(cropPath, buffer);

		const vertical = size.x < size.y;

		const [out] = await childProcess.exec(`${options.capture2TextCLIPath} --language Japanese --image ${cropPath} --line-breaks${vertical ? " --vertical" : ""}`);
		return out.toString("utf8").trim();
	}

	private getCapturePagePath () {
		return `${options.root}/${this.volume}/${this.chapter}/capture/${this.page.slice(0, -4)}`;
	}
}
