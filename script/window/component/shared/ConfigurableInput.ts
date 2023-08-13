import type { TextGenerator } from "component/Component";
import Component from "component/Component";
import Button, { ButtonClasses, ButtonDisplayMode } from "component/shared/Button";
import Drawer from "component/shared/Drawer";
import type { InputEvents } from "component/shared/Input";
import Input from "component/shared/Input";
import { sleep } from "util/Async";
import type { IEventEmitter } from "util/EventEmitter";

export enum ConfigurableInputClasses {
	Main = "input-configurable-wrapper",
	Input = "input-configurable-input",
	ConfigureButton = "input-configurable-configure-button",
	ConfigureButtonEnabled = "input-configurable-configure-button-enabled",
	Drawer = "input-configurable-drawer",
}

export default class ConfigurableInput extends Component {

	declare event: IEventEmitter<this, InputEvents>;

	public readonly input = new Input()
		.classes.add(ConfigurableInputClasses.Input)
		.setPlaceholder("search")
		.appendTo(this);

	public readonly configureButton = new Button()
		.classes.add(ConfigurableInputClasses.ConfigureButton)
		.setIcon("\uE115")
		.setDisplayMode(ButtonDisplayMode.IconOnly)
		.listeners.add("mouseenter", () => this.configureDrawer.open("hover"))
		.listeners.add("mouseleave", () => this.configureDrawer.close("hover"))
		.event.subscribe("click", button => {
			this.configureDrawer.toggleOpen("click");
			button.classes.toggle(this.configureDrawer.isOpenFor("click"), ConfigurableInputClasses.ConfigureButtonEnabled, ButtonClasses.Active);
		})
		.appendTo(this);

	public readonly configureDrawer = new Drawer(this)
		.classes.add(ConfigurableInputClasses.Drawer);

	public constructor () {
		super();
		this.classes.add(ConfigurableInputClasses.Main);

		this.event.subscribe("append", () => sleep(0.01).then(this.configureDrawer.refresh));
		this.input.event.subscribe("change", () => this.event.emit("change"));
	}

	public setConfigureIcon (icon: string | null) {
		this.configureButton.setIcon(icon);
		return this;
	}

	public configure (initialiser: (drawer: Drawer) => any) {
		initialiser(this.configureDrawer);
		return this;
	}

	public getText () {
		return this.input.getText();
	}

	public setPlaceholder (translation: TextGenerator<Input>) {
		this.input.setPlaceholder(translation);
		return this;
	}

	@Bound public override refreshText () {
		this.input.refreshText();
		return this;
	}
}
