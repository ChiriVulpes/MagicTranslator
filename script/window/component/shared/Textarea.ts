import Component, { TextGenerator } from "component/Component";
import Translation from "util/string/Translation";

export default class Textarea extends Component {

	private static readonly list: Textarea[] = [];
	private static index = 0;
	private static setTextareaHeight () {
		if (!Textarea.list.length) return;

		const count = Math.min(50, Textarea.list.length);
		for (let i = 0; i < count; i++) {
			if (!Textarea.list.length) return;
			if (Textarea.index >= Textarea.list.length || Textarea.index < 0) Textarea.index = 0;

			const textarea = Textarea.list[Textarea.index++];
			if (!document.contains(textarea.element())) Textarea.list.splice(--Textarea.index, 1);
			else textarea.setHeight();
		}

		setTimeout(Textarea.setTextareaHeight, 10);
	}

	private textarea = new Component("textarea")
		.listeners.add(["change", "keyup", "paste", "input", "focus"], this.onChange)
		.listeners.add("blur", this.onBlur)
		.listeners.add("contextmenu", this.onContextMenu)
		.appendTo(this);

	private hiddenTextarea = new Component()
		.classes.add("textarea-hidden")
		.appendTo(this);

	private placeholderTextGenerator?: (component: any) => string | number;

	public constructor () {
		super();
		this.classes.add("textarea");

		this.listeners.waitFor("append")
			.then(() => {
				const shouldStart = !Textarea.list.length;
				Textarea.list.push(this);
				if (shouldStart) Textarea.setTextareaHeight();
			});
	}

	public getText () {
		return this.textarea.element<HTMLTextAreaElement>().value;
	}

	public getHeight () {
		return this.hiddenTextarea.box().height;
	}

	public setPlaceholder (translation: TextGenerator<this>) {
		if (typeof translation === "string") translation = new Translation(translation);
		this.placeholderTextGenerator = translation instanceof Translation ? translation.get : translation;
		this.refreshText();
		return this;
	}

	@Override @Bound public refreshText () {
		this.textarea.element<HTMLTextAreaElement>().value = this.textGenerator ? `${this.textGenerator(this)}` : "";
		this.setHiddenTextareaText();
		this.attributes.set("placeholder", this.placeholderTextGenerator ? `${this.placeholderTextGenerator(this)}` : "");
		this.setHeight();
		this.emit("change");
		return this;
	}

	@Bound private onChange (event: Event) {
		if (event.type === "change") {
			event.stopPropagation();
		}

		this.setHiddenTextareaText();
		this.setHeight();
		this.emit("change");
	}

	@Bound private setHeight (height = this.getHeight()) {
		this.style.set("--height", `${height}px`);
		return this;
	}

	private setHiddenTextareaText () {
		this.hiddenTextarea.element().textContent = this.textarea.element<HTMLTextAreaElement>().value.replace(/\n$/, "\n\xa0");
	}

	@Bound private onBlur () {
		this.textarea.element<HTMLTextAreaElement>().value = this.textarea.element<HTMLTextAreaElement>().value.trim();
		this.setHiddenTextareaText();
		this.emit("blur");
	}

	@Bound private onContextMenu (event: MouseEvent) {
		const textarea = Component.get(event);
		textarea.element<HTMLTextAreaElement>().select();
		document.execCommand("copy");
	}

}
