import Component from "component/Component";
import Button from "component/shared/Button";

export default class ButtonBar extends Component {
	public constructor () {
		super();
		this.classes.add("button-bar");
	}

	public addButton (button: Button): this;
	public addButton (initializer: (button: Button) => any): this;
	public addButton (button: Button | ((button: Button) => any)) {
		if (typeof button === "function") new Button().schedule(button).appendTo(this);
		else button.appendTo(this);
		return this;
	}
}
