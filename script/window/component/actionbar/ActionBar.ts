import Component from "component/Component";
import { construct } from "util/IterableIterator";
import IndexedMap from "util/Map";
import Translation from "util/string/Translation";

export type ActionInitializer = (actionButton: ActionButton) => ActionButton;
export type Action<K extends string | number = string | number> = [K, ActionInitializer];

export default class ActionBar<K extends string | number = string | number> extends Component {
	private actions: IndexedMap<K, ActionButton>;

	public constructor(...actions: Action<K>[]) {
		super();
		this.classes.add("action-bar");

		this.setActions(...actions);
	}

	public setActions<K2 extends string | number = string | number> (...actions: Action<K2>[]) {
		this.dump();
		this.emit("reset");

		this.actions = actions.values()
			.map<[K2, ActionButton]>(([id, initializer]) => [id, new ActionButton(id)
				.listeners.add("click", () => this.emit<K2>("action", event => event.data = id))
				.schedule(initializer)
				.appendTo(this)])
			.collect(construct(IndexedMap));

		return this as any as ActionBar<K2>;
	}

	public hideActions (...actions: K[]) {
		for (const actionButton of actions.values().map(this.actions.get)) {
			actionButton!.hide();
		}
	}

	public showActions (...actions: K[]) {
		for (const actionButton of actions.values().map(this.actions.get)) {
			actionButton!.show();
		}
	}

	public setVisibleActions (...actions: K[]) {
		for (const [id, actionButton] of this.actions.entries()) {
			actionButton.toggle(actions.includes(id));
		}
	}

	public toggleActions (...actionStates: [K, boolean][]) {
		for (const [id, enabled] of actionStates) {
			this.actions.get(id)!.classes.toggle(!enabled, "disabled");
		}
	}
}

export class ActionButton extends Component {
	private text: Component | undefined;

	public constructor(id: any) {
		super();
		this.classes.add("action-button");
		this.attributes.set("action-id", id);
	}

	public setIcon (icon: string) {
		return this.style.set("--icon", `"${icon}"`);
	}

	public setText (translation: string | Translation<string> | (() => string | number)) {
		this.text = this.text || new Component();
		this.text.setText(translation).appendTo(this);
		return this;
	}

	public setSide (side: "left" | "right") {
		return this.classes.toggle(side === "right", "right");
	}
}
