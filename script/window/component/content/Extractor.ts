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
	private readonly translation: Component;

	public constructor(public readonly capture: Capture) {
		super();
		this.classes.add("capture");

		new Component()
			.append(new Component("img")
				.attributes.set("src", capture.cropPath))
			.appendTo(this);

		new Component()
			.append(this.translation = new Component("textarea")
				.classes.add("translation")
				.attributes.set("rows", "1")
				.setText(() => capture.text)
				.listeners.add(["change", "keyup", "paste", "input"], this.changeTranslation)
				.listeners.add("blur", this.blurTranslation))
			.appendTo(this);

		this.updateTranslationHeight();
	}

	@Bound
	private changeTranslation () {
		this.capture.text = this.translation.element<HTMLTextAreaElement>().value;
		this.updateTranslationHeight();
		this.emit("change");
	}

	@Bound
	private blurTranslation () {
		this.capture.text = this.translation.element<HTMLTextAreaElement>().value = this.translation.element<HTMLTextAreaElement>().value.trim();
		this.updateTranslationHeight();
		this.emit("change");
	}

	private updateTranslationHeight () {
		const lines = this.capture.text.split("\n").length;
		this.translation.style.set("--height", Math.min(80, lines * 29));
		this.translation.classes.toggle(lines > 4, "overflow");
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
					.attributes.set("src", `${options.root}/${volume}/${chapter}/raw/${page}`)))
			.appendTo(this);

		new Component()
			.classes.add("extraction-drawer")
			.append(new Component()
				.classes.add("extraction-actions"))
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
	}

	private addCapture (capture: Capture) {
		this.captures.push(new CaptureComponent(capture)
			.listeners.add("change", this.updateJSON)
			.listeners.add("mouseenter", this.mouseEnterCapture)
			.appendTo(this.capturesWrapper));
	}

	@Bound
	private mouseEnterCapture (event: MouseEvent) {
		const component = Component.get<CaptureComponent>(event).listeners.add("mouseleave", this.mouseLeaveCapture);
		this.classes.add("selecting");

		this.style.set("--capture-x", component.capture.position.x);
		this.style.set("--capture-y", component.capture.position.y + this.pageImage.position().y - 73);
		this.style.set("--capture-w", component.capture.size.x);
		this.style.set("--capture-h", component.capture.size.y);
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

		// const windowPosition = await window.send<{ x: number; y: number }>("window-get-position");
		// const captureStart = this.captureStart.plus(windowPosition);
		// const captureEnd = this.captureEnd.plus(windowPosition);

		const size = Vector.size(this.captureStart, this.captureEnd);
		if (size.x < 30 || size.y < 30) {
			return;
		}

		const position = Vector.min(this.captureStart, this.captureEnd);

		const canvas = document.createElement("canvas");
		canvas.width = size.x;
		canvas.height = size.y;
		const context = canvas.getContext("2d")!;

		const drawPosition = position.minus(this.pageImage.position());
		context.drawImage(this.pageImage.element<HTMLImageElement>(), -drawPosition.x, -drawPosition.y);

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
