import Component, { TextGenerator } from "component/Component";
import Bound from "util/Bound";

export default class LabelledRow extends Component {
	private readonly label: Component;

	public constructor (label: TextGenerator) {
		super();
		this.classes.add("labelled-row");
		this.label = new Component("label")
			.setText(label)
			.appendTo(this);
	}

	@Bound
	public refreshText () {
		this.label.refreshText();
		return this;
	}
}
