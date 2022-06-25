import type { TextGenerator } from "component/Component";
import Component from "component/Component";

export default class LabelledRow extends Component {
	private readonly label: Component;

	public constructor (label: TextGenerator<Component>) {
		super();
		this.classes.add("labelled-row");
		this.label = new Component("label")
			.setText(label)
			.appendTo(this);
	}

	@Bound public override refreshText () {
		this.label.refreshText();
		return this;
	}
}
