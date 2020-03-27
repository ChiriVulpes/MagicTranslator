import Component, { TextGenerator } from "component/Component";
import { Events, IEventEmitter } from "util/EventEmitter";
import Translation from "util/string/Translation";

interface InputEvents extends Events<Component> {
	change (): any;
}

export default class Input extends Component {

	@Override public readonly event: IEventEmitter<this, InputEvents>;

	private placeholderTextGenerator?: (component: any) => string | number;

	public constructor () {
		super("input");
		this.listeners.add(["keyup", "paste", "input", "focus"], this.onChange);
		this.listeners.add("blur", this.onBlur);
	}

	public getText () {
		return this.element<HTMLInputElement>().value;
	}

	public setPlaceholder (translation: TextGenerator<this>) {
		if (typeof translation === "string") translation = new Translation(translation);
		this.placeholderTextGenerator = translation instanceof Translation ? translation.get : translation;
		this.refreshText();
		return this;
	}

	@Override @Bound public refreshText () {
		this.element<HTMLInputElement>().value = this.textGenerator ? `${this.textGenerator(this)}` : "";
		this.attributes.set("placeholder", this.placeholderTextGenerator ? `${this.placeholderTextGenerator(this)}` : "");
		this.event.emit("change");
		return this;
	}

	@Bound private onChange () {
		this.event.emit("change");
	}

	@Bound private onBlur () {
		this.element<HTMLTextAreaElement>().value = this.element<HTMLTextAreaElement>().value.trim();
	}
}
