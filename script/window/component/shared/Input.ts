import Component, { TextGenerator } from "component/Component";
import Bound from "util/Bound";
import Translation from "util/string/Translation";

export default class Input extends Component {
	private placeholderTextGenerator?: () => string | number;

	public constructor () {
		super("input");
		this.listeners.add(["keyup", "paste", "input", "focus"], this.onChange);
		this.listeners.add("blur", this.onBlur);
	}

	public getText () {
		return this.element<HTMLInputElement>().value;
	}

	public setPlaceholder (translation: TextGenerator) {
		if (typeof translation === "string") translation = new Translation(translation);
		this.placeholderTextGenerator = translation instanceof Translation ? translation.get : translation;
		this.refreshText();
		return this;
	}

	@Bound
	public refreshText () {
		this.element<HTMLInputElement>().value = this.textGenerator ? `${this.textGenerator()}` : "";
		this.attributes.set("placeholder", this.placeholderTextGenerator ? `${this.placeholderTextGenerator()}` : "");
		this.emit("change");
		return this;
	}

	@Bound
	private onChange () {
		this.emit("change");
	}

	@Bound
	private onBlur () {
		this.element<HTMLTextAreaElement>().value = this.element<HTMLTextAreaElement>().value.trim();
	}
}
