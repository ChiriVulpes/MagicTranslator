import Component from "component/Component";
import Bound from "util/Bound";
import { tuple } from "util/IterableIterator";
import { ComponentEvent } from "util/Manipulator";
import { Vector } from "util/math/Geometry";
import { pad } from "util/string/String";

interface Capture {
	id: number;
	position: { x: number; y: number };
	size: { x: number; y: number };
	text: string;
}

interface TranslationData {
	captureId: number;
	captures: Capture[];
}

class CaptureComponent extends Component {
	public dragStart?: Vector;
	public dragEnd?: Vector;
	public positionStart?: number;
	private scrollStart: number;
	private lastMoveEvent?: MouseEvent;

	private readonly japanese: Component;

	public constructor(root: string, public readonly capture: Capture) {
		super();
		this.classes.add("capture");

		new Component()
			.append(new Component("img")
				.attributes.set("src", `${root}/cap${pad(capture.id, 3)}.png`))
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

		this.listeners.add("mousedown", this.mouseDown);
	}

	@Bound
	public mouseMove (event = this.lastMoveEvent) {
		this.lastMoveEvent = event;
		this.dragEnd = Vector.get(event!);

		this.classes.add("moving");
		const y = this.positionStart! + (this.dragEnd.y - this.dragStart!.y) + (this.parent!.element().scrollTop - this.scrollStart);
		this.style.set("--drag-y", y - this.parent!.element().scrollTop + this.parent!.box().top);

		this.emit<[CaptureComponent, number]>("move-update", updateEvent => updateEvent.data = tuple(this, y));

		return y;
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

	@Bound
	private mouseDown (event: MouseEvent) {
		if (Component.get(event) !== this) return;

		const box = this.box();
		this.scrollStart = this.parent!.element().scrollTop;
		this.positionStart = box.top - this.parent!.box().top + this.scrollStart;
		this.dragStart = Vector.get(event);
		this.style.set("--width", box.width);

		this.parent!.style.set("--captures-height", `${this.parent!.element().scrollHeight}px`);

		Component.window.listeners.add<MouseEvent>("mousemove", this.mouseMove);
		Component.window.listeners.add<MouseEvent>("mouseup", this.mouseUp);
	}

	@Bound
	private mouseUp (event: MouseEvent) {
		const y = this.mouseMove(event);
		this.classes.remove("moving");

		Component.window.listeners.remove<MouseEvent>("mousemove", this.mouseMove);
		Component.window.listeners.remove<MouseEvent>("mouseup", this.mouseUp);

		this.emit<[CaptureComponent, number]>("move-complete", completeEvent => completeEvent.data = tuple(this, y));

		this.parent!.style.remove("--captures-height");
	}
}

export default class Extractor extends Component {
	private readonly pageImage: Component;
	private readonly capturesWrapper: Component;
	private readonly captures: CaptureComponent[] = [];

	private captureStart: Vector;
	private captureEnd: Vector;
	private captureId = 0;
	private movingCapture = false;
	private scrollSpeed = 0;
	private scrollAnimation: number | undefined;

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
					.classes.add("float-right")
					.setText("next-page")
					.classes.toggle(!hasNextPage, "disabled")
					.listeners.add("click", () => this.emit("next")))
				.append(new Component("button")
					.classes.add("float-right")
					.setText("previous-page")
					.classes.toggle(!hasPreviousPage, "disabled")
					.listeners.add("click", () => this.emit("previous"))))
			.append(new Component()
				.classes.add("extraction-captures-wrapper")
				.append(this.capturesWrapper = new Component()
					.classes.add("extraction-captures")))
			.appendTo(this);

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

	private addCapture (capture: Capture) {
		this.captures.push(new CaptureComponent(this.getCapturePagePath(), capture)
			.listeners.add("change", this.updateJSON)
			.listeners.add<MouseEvent>("mouseenter", this.mouseEnterCapture)
			.listeners.add("remove-capture", this.removeCapture)
			.listeners.add("move-update", this.updateMove)
			.listeners.add("move-complete", this.completeMove)
			.appendTo(this.capturesWrapper));
	}

	@Bound
	private updateMove ({ data: [movingComponent, y] }: ComponentEvent<[CaptureComponent, number]>) {
		this.movingCapture = true;
		this.style.set("--moving-capture-height", `${movingComponent.box().height}px`);
		y += movingComponent.box().height / 2;

		let totalY = 0;
		let lastComponent: CaptureComponent | undefined;

		for (let i = 0; i < this.captures.length; i++) {
			const component = this.captures[i];
			if (component === movingComponent) continue;

			component.classes.remove("moving-before");

			const box = component.box();
			if (y >= totalY && y < totalY + box.height) {
				if (lastComponent) lastComponent.classes.remove("moving-before");
				lastComponent = component.classes.add("moving-before");
			}

			totalY += box.height;
		}

		this.updateScroll(y);
	}

	private updateScroll (y?: number) {
		if (!this.movingCapture) return;

		if (y !== undefined) {
			if (this.scrollAnimation !== undefined) cancelAnimationFrame(this.scrollAnimation);

			const screenY = y - this.capturesWrapper.element().scrollTop;
			const capturesHeight = this.capturesWrapper.element().clientHeight;

			this.scrollSpeed = screenY < 100 ? (100 - screenY) / -2 :
				screenY > capturesHeight - 100 ? (screenY - (capturesHeight - 100)) / 2 : 0;
		}

		this.capturesWrapper.element().scrollTop += this.scrollSpeed;

		if (y === undefined) {
			this.capturesWrapper.descendants<CaptureComponent>(".moving").first()!.mouseMove();
		}

		this.scrollAnimation = requestAnimationFrame(() => this.updateScroll());
	}

	@Bound
	private completeMove ({ data: [movingComponent, y] }: ComponentEvent<[CaptureComponent, number]>) {
		y += movingComponent.box().height / 2;

		let totalY = 0;
		let insertIndex = -1;

		for (let i = 0; i < this.captures.length; i++) {
			const component = this.captures[i];
			if (component === movingComponent) continue;

			const box = component.box();
			component.classes.remove("moving-before");
			if (y >= totalY && y < totalY + box.height) {
				insertIndex = i;
			}

			totalY += box.height;
		}

		const oldIndex = this.captures.indexOf(movingComponent);
		this.captures.splice(oldIndex, 1);

		insertIndex = oldIndex < insertIndex ? insertIndex - 1 : insertIndex;
		const beforeComponent = this.captures[insertIndex];

		if (beforeComponent) {
			this.capturesWrapper.element().insertBefore(movingComponent.element(), beforeComponent.element());
			this.captures.splice(insertIndex, 0, movingComponent);
		} else {
			this.capturesWrapper.append(movingComponent);
			this.captures.push(movingComponent);
		}

		this.updateJSON();
		this.movingCapture = false;
		this.mouseLeaveCapture();
	}

	@Bound
	private removeCapture (event: Event) {
		const component = Component.get<CaptureComponent>(event);
		const index = this.captures.indexOf(component);
		this.captures.splice(index, 1);
		component.remove();

		const capture = component.capture;
		fs.unlink(`${this.getCapturePagePath()}/cap${pad(capture.id, 3)}.png`);

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
	private mouseEnterCapture (eventOrCaptureComponent: MouseEvent | CaptureComponent) {
		const component = eventOrCaptureComponent instanceof CaptureComponent ? eventOrCaptureComponent :
			Component.get<CaptureComponent>(eventOrCaptureComponent).listeners.add<MouseEvent>("mouseleave", this.mouseLeaveCapture);

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
	private mouseLeaveCapture (event?: MouseEvent) {
		if (event) Component.get(event).listeners.remove<MouseEvent>("mouseleave", this.mouseLeaveCapture);
		this.classes.remove("selecting");

		if (this.movingCapture) {
			this.capturesWrapper.descendants<CaptureComponent>(".moving")
				.first()!
				.schedule(this.mouseEnterCapture);
		}
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
		await fs.mkdir(this.getCapturePagePath());

		const captureId = this.captureId;
		const cropPath = `${this.getCapturePagePath()}/cap${pad(this.captureId++, 3)}.png`;
		await fs.writeFile(cropPath, buffer);

		const vertical = size.x < size.y;

		const [out] = await childProcess.exec(`${options.capture2TextCLIPath} --language Japanese --image ${cropPath} --line-breaks${vertical ? " --vertical" : ""}`);

		this.addCapture({
			id: captureId,
			position: position.raw(),
			size: size.raw(),
			text: out.toString("utf8").trim(),
		});

		await this.updateJSON();
	}

	private getCapturePagePath () {
		return `${options.root}/${this.volume}/${this.chapter}/capture/${this.page.slice(0, -4)}`;
	}
}
