import Component, { TextGenerator } from "component/Component";
import Button from "component/shared/Button";
import { Events, IEventEmitter } from "util/EventEmitter";

export enum InterruptChoice {
	No = "no",
	Cancel = "cancel",
	Yes = "yes",
	Dismiss = "dismiss",
	Done = "done",
}

interface InterruptEvents<O extends string> extends Events<Component> {
	resolve (choice: O): any;
}

export default class Interrupt<O extends string = string> extends Component {
	public static async info (initializer: (interruptScreen: Interrupt<string>) => any) {
		await Interrupt.choice(interrupt => interrupt
			.setActions(InterruptChoice.Dismiss)
			.schedule(initializer));
	}

	public static async confirm (initializer: (interruptScreen: Interrupt<string>) => any) {
		const choice = await Interrupt.choice(interrupt => interrupt
			.setActions(InterruptChoice.No, InterruptChoice.Yes)
			.schedule(initializer));
		return choice === InterruptChoice.Yes;
	}

	public static async remove (initializer: (interruptScreen: Interrupt<InterruptChoice.Cancel | "remove">) => any) {
		const confirm = await Interrupt.choice<InterruptChoice.Cancel | "remove">(interrupt => interrupt
			.setActions(InterruptChoice.Cancel, "remove")
			.schedule(i => i
				.getAction("remove")!
				.classes.add("warning")
				.setIcon("\uE107"))
			.schedule(initializer));
		return confirm === "remove";
	}

	public static choice<O extends string = InterruptChoice> (initializer: (interruptScreen: Interrupt<O>) => any) {
		return new Promise<O>(resolve => new Interrupt<O>()
			.classes.add("center")
			.appendTo(Component.get("#content"))
			.schedule(initializer)
			.show()
			.event.waitFor("resolve").then(([choice]) => resolve(choice)));
	}

	@Override public readonly event: IEventEmitter<this, InterruptEvents<O>>;

	protected content: Component;
	private readonly title: Component;
	private readonly description: Component;
	private readonly actions: Component;

	public constructor () {
		super();

		const hidden = Component.all(".interrupt:not(.hidden)").toArray();
		hidden.forEach(c => c.hide());
		this.event.waitFor("remove")
			.then(() => hidden.forEach(c => c.show()));

		this.classes.add("interrupt");

		this.content = new Component()
			.append(this.title = new Component()
				.classes.add("interrupt-title"))
			.append(this.description = new Component()
				.classes.add("interrupt-description"))
			.append(this.actions = new Component()
				.classes.add("interrupt-actions"))
			.appendTo(this);

		this.event.subscribe("show", this.onShow);

		for (const focusable of Component.all("button, textarea, input, a")) {
			if (focusable.matches(".interrupt:not(.hidden) *")) return;

			focusable.data.set("previousTabindex", focusable.attributes.get("tabindex"));
			focusable.attributes.set("tabindex", "-1");
		}

		this.show();
	}

	public setTitle (text: TextGenerator<Component>) {
		this.title.setText(text);
		return this;
	}

	public setDescription (text: TextGenerator<Component>) {
		this.description.setText(text);
		return this;
	}

	public setActions (...actions: InterruptChoice[]): this;
	public setActions (...actions: string[]): this;
	public setActions (...actions: string[]) {
		this.actions.dump();

		for (const action of actions) {
			new Button()
				.attributes.set("action", action)
				.setIcon(this.getIcon(action))
				.setText(action)
				.event.subscribe("click", () => this.resolve(action))
				.appendTo(this.actions);
		}

		return this;
	}

	public getAction (action: string) {
		return this.actions.descendants<Button>(`:scope > button[action="${action}"]`).first();
	}

	@Bound protected keyup (key: KeyboardEvent) {
		if (key.code === "Enter") this.resolve(InterruptChoice.Yes) || this.resolve(InterruptChoice.Dismiss);
		if (key.code === "Escape") this.resolve(InterruptChoice.No) || this.resolve(InterruptChoice.Done);
	}

	protected getIcon (action: string) {
		switch (action) {
			case InterruptChoice.Cancel: return "\uE10A";
			case InterruptChoice.No: return "\uE10A";
			case InterruptChoice.Yes: return "\uE10B";
			case InterruptChoice.Dismiss: return "\uE10B";
			case InterruptChoice.Done: return "\uE10B";
		}

		return null;
	}

	@Bound private async onShow () {
		const closePromise = this.event.waitFor(["hide", "remove"]);
		Component.window.listeners.until(closePromise)
			.add("keyup", this.keyup, true);

		await closePromise;

		for (const focusable of Component.all("[data-previous-tabindex]")) {
			focusable.attributes.set("tabindex", focusable.data.get("previousTabindex"));
			focusable.data.remove("previousTabindex");
		}
	}

	private resolve (choice: string) {
		if (!this.actions.children().any(action => action.attributes.get("action") === choice)) return false;

		this.remove();
		this.event.emit("resolve", choice as O);

		return true;
	}
}
