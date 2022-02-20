import Component from "component/Component";
import Tooltip from "component/shared/Tooltip";
import { Events, IEventEmitter } from "util/EventEmitter";

export enum ButtonDisplayMode {
	Normal = "normal",
	IconOnly = "icon-only",
	TextOnly = "text-only",
}

interface ButtonEvents extends Events<Component> {
	click (): any;
}

export default class Button extends Component {

	public static setDisplayMode (mode: ButtonDisplayMode) {
		Component.document.attributes.set("button-display-mode", mode);

		Component.all<Button>("button")
			.filter(button => button instanceof Button)
			.forEach(button => button.refreshText());

		if ("options" in window) options.buttonDisplayMode = mode;
	}

	public static getDisplayMode () {
		return Component.document.attributes.get("button-display-mode") as ButtonDisplayMode;
	}

	declare event: IEventEmitter<this, ButtonEvents>;

	public constructor () {
		super("button");
		this.listeners.add("click", () => this.event.emit("click"));
	}

	public setIcon (icon: string | null) {
		this.attributes.set("icon", icon);
		Tooltip.register(this, this.initializeTooltip);
		return this;
	}

	@Override @Bound public refreshText () {
		let text = this.textGenerator ? this.textGenerator(this) as any : "";
		if (Component.document.attributes.get("button-display-mode") === ButtonDisplayMode.IconOnly && this.attributes.has("icon"))
			text = "";
		this.element().textContent = text === null || text === undefined ? "" : `${text}`;
		return this;
	}

	@Bound public initializeTooltip (tooltip: Tooltip) {
		if (Button.getDisplayMode() === ButtonDisplayMode.IconOnly) tooltip.inheritText(this);
		return tooltip;
	}
}

Button.setDisplayMode(ButtonDisplayMode.Normal);
