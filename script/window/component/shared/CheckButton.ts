import Component from "component/Component";
import EventEmitter, { Events } from "util/EventEmitter";

interface CheckButtonEvents extends Events<Component> {
	toggle (enabled: boolean): any;
}

export default class CheckButton extends Component {

	@Override public readonly event: EventEmitter<this, CheckButtonEvents>;

	public constructor () {
		super("button");
		this.classes.add("check-button");
		this.listeners.add("click", this.toggleChecked);
	}

	public isChecked () {
		return this.classes.has("checked");
	}

	public setChecked (checked = true) {
		this.classes.toggle(checked, "checked");
		this.event.emit("toggle", checked);
		return this;
	}

	@Bound public toggleChecked () {
		this.classes.toggle("checked");
		this.event.emit("toggle", this.classes.has("checked"));
		return this;
	}
}
