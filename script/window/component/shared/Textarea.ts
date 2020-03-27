import Component, { TextGenerator } from "component/Component";
import { Events, IEventEmitter } from "util/EventEmitter";
import Translation from "util/string/Translation";

interface TextareaEvents extends Events<Component> {
	change (): any;
	blur (): any;
}

export default class Textarea extends Component {

	@Override public readonly event: IEventEmitter<this, TextareaEvents>;

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
	}

	public getText () {
		return this.textarea.element<HTMLTextAreaElement>().value;
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
		this.event.emit("change");
		return this;
	}

	@Bound private onChange (event: Event) {
		if (event.type === "change") {
			event.stopPropagation();
		}

		this.setHiddenTextareaText();
		this.event.emit("change");
	}

	private setHiddenTextareaText () {
		this.hiddenTextarea.element().textContent = this.textarea.element<HTMLTextAreaElement>().value.replace(/\n$/, "\n\xa0");
	}

	@Bound private onBlur () {
		this.textarea.element<HTMLTextAreaElement>().value = this.textarea.element<HTMLTextAreaElement>().value.trim();
		this.setHiddenTextareaText();
		this.event.emit("blur");
	}

	@Bound private onContextMenu (event: MouseEvent) {
		const textarea = Component.get(event);
		textarea.element<HTMLTextAreaElement>().select();
		document.execCommand("copy");
	}

}
