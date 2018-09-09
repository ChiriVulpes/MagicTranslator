import Component, { TextGenerator } from "component/Component";
import { ComponentEvent } from "component/ComponentManipulator";
import Bound from "util/Bound";

export enum InterruptChoice {
	No = "no",
	Yes = "yes",
	Dismiss = "dismiss",
}

export default class Interrupt extends Component {
	public static async info (initializer: (interruptScreen: Interrupt) => any) {
		await this.interrupt(interrupt => interrupt
			.schedule(initializer)
			.setActions(InterruptChoice.Dismiss));
	}

	public static async confirm (initializer: (interruptScreen: Interrupt) => any) {
		const choice = await this.interrupt(interrupt => interrupt
			.schedule(initializer)
			.setActions(InterruptChoice.No, InterruptChoice.Yes));
		return choice === InterruptChoice.Yes;
	}

	private static interrupt (initializer: (interruptScreen: Interrupt) => any) {
		return new Promise<InterruptChoice>(resolve => Component.get<Interrupt>("#interrupt")
			.schedule(initializer)
			.show()
			.listeners.until("resolve").add<ComponentEvent<InterruptChoice>>("resolve", ({ data: choice }) => resolve(choice)));
	}

	private readonly title: Component;
	private readonly description: Component;
	private readonly actions: Component;

	public constructor() {
		super();
		this.setId("interrupt");

		new Component()
			.append(this.title = new Component()
				.classes.add("interrupt-title"))
			.append(this.description = new Component()
				.classes.add("interrupt-description"))
			.append(this.actions = new Component()
				.classes.add("interrupt-actions"))
			.appendTo(this);

		this.listeners.add("show", () =>
			Component.window.listeners.until(this.listeners.waitFor("hide"))
				.add("keyup", this.keyup, true));
	}

	public setTitle (text: TextGenerator) {
		this.title.setText(text);
		return this;
	}

	public setDescription (text: TextGenerator) {
		this.description.setText(text);
		return this;
	}

	public setActions (...actions: string[]) {
		this.actions.dump();

		for (const action of actions) {
			new Component("button")
				.data.set("action", action)
				.setText(action)
				.listeners.add("click", () => this.resolve(action))
				.appendTo(this.actions);
		}

		return this;
	}

	@Bound
	private keyup (key: KeyboardEvent) {
		if (key.code === "Enter") this.resolve(InterruptChoice.Yes) || this.resolve(InterruptChoice.Dismiss);
		if (key.code === "Escape") this.resolve(InterruptChoice.No);
	}

	private resolve (choice: string) {
		if (!this.actions.children().any(action => action.data.get("action") === choice)) return false;

		this.hide();
		this.emit<string>("resolve", event => event.data = choice);

		return true;
	}
}
