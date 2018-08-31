import Component from "component/Component";
import Bound from "util/Bound";
import { Vector } from "util/math/Geometry";
import { pad } from "util/string/String";

interface Capture {
	cropPath: string;
	position: { x: number; y: number };
	size: { x: number; y: number };
	text: string;
}

interface TranslationData {
	captureId: number;
	captures: Capture[];
}

class CaptureComponent extends Component {
	private readonly japanese: Component;

	public constructor(public readonly capture: Capture) {
		super();
		this.classes.add("capture");

		new Component()
			.append(new Component("img")
				.attributes.set("src", capture.cropPath))
			.appendTo(this);

		new Component()
			.append(this.japanese = new Component("textarea")
				.classes.add("japanese")
				.attributes.set("rows", "1")
				.setText(() => capture.text)
				.listeners.add(["change", "keyup", "paste", "input"], this.changeJapanese)
				.listeners.add("blur", this.blurJapanese))
			.appendTo(this);

		new Component()
			.classes.add("capture-action-row")
			.append(new Component("button")
				.setText("remove")
				.listeners.add("click", () => this.emit("remove-capture")))
			.appendTo(this);

		this.updateJapaneseHeight();
	}

	@Bound
	private changeJapanese () {
		this.capture.text = this.japanese.element<HTMLTextAreaElement>().value;
		this.updateJapaneseHeight();
		this.emit("change");
	}

	@Bound
	private blurJapanese () {
		this.capture.text = this.japanese.element<HTMLTextAreaElement>().value = this.japanese.element<HTMLTextAreaElement>().value.trim();
		this.updateJapaneseHeight();
		this.emit("change");
	}

	private updateJapaneseHeight () {
		const lines = this.capture.text.split("\n").length;
		this.japanese.style.set("--height", Math.min(2.75862069, lines));
		this.japanese.classes.toggle(lines > 4, "overflow");
	}
}

export default class Extractor extends Component {
	private readonly pageImage: Component;
	private readonly capturesWrapper: Component;
	private readonly captures: CaptureComponent[] = [];

	private captureStart: Vector;
	private captureEnd: Vector;
	private captureId = 0;

	public constructor(private readonly volume: string, private readonly chapter: string, private readonly page: string) {
		super();
		this.setId("extractor");

		new Component()
			.classes.add("page-wrapper")
			.append(new Component()
				.append(this.pageImage = new Component("img")
					.attributes.set("src", `${options.root}/${volume}/${chapter}/raw/${page}`)
					.listeners.add("load", () => {
						const image = this.pageImage.element<HTMLImageElement>();
						this.pageImage.style.set("--natural-width", `${image.naturalWidth}px`);
						this.pageImage.style.set("--natural-height", `${image.naturalHeight}px`);
					})))
			.appendTo(this);

		new Component()
			.classes.add("extraction-drawer")
			.append(new Component()
				.classes.add("extraction-actions")
				.append(new Component("button")
					.setText("back")
					.listeners.add("click", () => this.emit("quit"))))
			.append(new Component()
				.classes.add("extraction-captures-wrapper")
				.append(this.capturesWrapper = new Component()
					.classes.add("extraction-captures")))
			.appendTo(this);

		this.initialize();
	}

	private async initialize () {
		const jsonData = await fs.readFile(`${options.root}/${this.volume}/${this.chapter}/capture/${this.page.slice(0, -4)}.json`, "utf8")
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

	private addCapture (capture: Capture) {
		this.captures.push(new CaptureComponent(capture)
			.listeners.add("change", this.updateJSON)
			.listeners.add("mouseenter", this.mouseEnterCapture)
			.listeners.add("remove-capture", this.removeCapture)
			.appendTo(this.capturesWrapper));
	}

	@Bound
	private removeCapture (event: Event) {
		const component = Component.get<CaptureComponent>(event);
		const index = this.captures.indexOf(component);
		this.captures.splice(index, 1);
		component.remove();

		// we were just hovering over a capture, but now it's gone, so the "leave" event will never fire
		this.classes.remove("selecting");
		this.updateJSON();
	}

	@Bound
	private keyup (event: KeyboardEvent) {
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
	private mouseEnterCapture (event: MouseEvent) {
		const component = Component.get<CaptureComponent>(event).listeners.add("mouseleave", this.mouseLeaveCapture);
		this.classes.add("selecting");

		const scale = this.pageImage.box().size().over(Vector.getNaturalSize(this.pageImage.element<HTMLImageElement>()));

		const position = new Vector(component.capture.position).times(scale);
		const size = new Vector(component.capture.size).times(scale);

		this.style.set("--capture-x", position.x + this.pageImage.box().left);
		this.style.set("--capture-y", position.y + this.pageImage.box().top);
		this.style.set("--capture-w", size.x);
		this.style.set("--capture-h", size.y);
	}

	@Bound
	private mouseLeaveCapture (event: MouseEvent) {
		Component.get(event).listeners.remove("mouseleave", this.mouseLeaveCapture);
		this.classes.remove("selecting");
	}

	@Bound
	private async updateJSON () {
		const translationData: TranslationData = {
			captureId: this.captureId,
			captures: this.captures.map(component => component.capture),
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
		await fs.mkdir(`${options.root}/${this.volume}/${this.chapter}/capture/${this.page.slice(0, -4)}`);

		const cropPath = `${options.root}/${this.volume}/${this.chapter}/capture/${this.page.slice(0, -4)}/cap${pad(this.captureId++, 3)}.png`;
		await fs.writeFile(cropPath, buffer);

		const vertical = size.x < size.y;

		const [out] = await childProcess.exec(`${options.capture2TextCLIPath} --language Japanese --image ${cropPath} --line-breaks${vertical ? " --vertical" : ""}`);

		this.addCapture({
			cropPath,
			position: position.raw(),
			size: size.raw(),
			text: out.toString("utf8").trim(),
		});

		await this.updateJSON();
	}
}
