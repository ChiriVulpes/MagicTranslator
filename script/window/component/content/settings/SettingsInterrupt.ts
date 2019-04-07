import Component from "component/Component";
import Interrupt, { InterruptChoice } from "component/shared/Interrupt";

export default class SettingsInterrupt extends Interrupt {
	private readonly sections = new Component()
		.classes.add("sections")
		.appendTo(this.content, "beginning");

	public constructor () {
		super();
		this.classes.add("settings-interrupt");
		this.setActions(InterruptChoice.Done);
		this.appendTo(Component.get("#content"));
		this.show();
	}

	@Bound @Override protected keyup (event: KeyboardEvent) {
		if (this.descendants(".error").first()) return;
		super.keyup(event);
	}

	protected updateDoneButton () {
		this.descendants("[action='done']")
			.first()!
			.setDisabled(!!this.descendants(".error").first());
	}

	protected addSection (name: string) {
		return new Component("section")
			.attributes.set("section", name)
			.append(new Component("h2")
				.setText(name))
			.appendTo(this.sections);
	}
}
