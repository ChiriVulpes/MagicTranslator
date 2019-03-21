import Component, { TextGenerator } from "component/Component";
import { sleep } from "util/Async";
import Bound from "util/Bound";
import Translation from "util/string/Translation";

export default class Textarea extends Component {

	private textarea = new Component("textarea")
		.listeners.add(["change", "keyup", "paste", "input", "focus"], this.onChange)
		.listeners.add("blur", this.onBlur)
		.listeners.add("contextmenu", this.onContextMenu)
		.appendTo(this);

	private hiddenTextarea = new Component()
		.classes.add("textarea-hidden")
		.appendTo(this);

	private placeholderTextGenerator: () => string | number;
	private handleHeight = true;

	public constructor () {
		super();
		this.classes.add("textarea");
	}

	public getText () {
		return this.textarea.element<HTMLTextAreaElement>().value;
	}

	public getHeight () {
		return this.hiddenTextarea.box().height;
	}

	public setHandleHeight (handleHeight: boolean) {
		this.handleHeight = handleHeight;
		return this;
	}

	@Bound
	public setHeight (height = this.getHeight()) {
		this.style.set("--height", `${height}px`);
		return this;
	}

	public setPlaceholder (translation: TextGenerator) {
		if (typeof translation === "string") translation = new Translation(translation);
		this.placeholderTextGenerator = translation instanceof Translation ? translation.get : translation;
		this.refreshText();
		return this;
	}

	@Bound
	public refreshText () {
		this.textarea.element<HTMLTextAreaElement>().value = this.textGenerator ? `${this.textGenerator()}` : "";
		this.setHiddenTextareaText();
		this.attributes.set("placeholder", this.placeholderTextGenerator ? `${this.placeholderTextGenerator()}` : "");
		if (this.handleHeight) sleep(0.3).then(() => this.setHeight());
		this.emit("change");
		return this;
	}

	@Bound
	private onChange (event: Event) {
		if (event.type === "change") {
			event.stopPropagation();
		}

		this.setHiddenTextareaText();
		if (this.handleHeight) sleep(0.01).then(() => this.setHeight());
		this.emit("change");
	}

	private setHiddenTextareaText () {
		this.hiddenTextarea.element().textContent = this.textarea.element<HTMLTextAreaElement>().value.replace(/\n$/, "\n\xa0");
	}

	@Bound
	private onBlur () {
		this.textarea.element<HTMLTextAreaElement>().value = this.textarea.element<HTMLTextAreaElement>().value.trim();
		this.setHiddenTextareaText();
		this.emit("blur");
	}

	@Bound
	private onContextMenu (event: MouseEvent) {
		const textarea = Component.get(event);
		textarea.element<HTMLTextAreaElement>().select();
		document.execCommand("copy");
	}

}
