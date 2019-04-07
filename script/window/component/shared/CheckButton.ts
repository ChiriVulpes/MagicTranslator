import Component from "component/Component";

export default class CheckButton extends Component {
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
		this.emit("toggle");
		return this;
	}

	@Bound public toggleChecked () {
		this.classes.toggle("checked");
		this.emit("toggle");
		return this;
	}
}
