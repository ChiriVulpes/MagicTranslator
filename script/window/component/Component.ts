import {
	AttributeManipulator,
	ClassManipulator,
	ComponentEvent,
	DataManipulator,
	EventListenerManipulator,
	StyleManipulator,
} from "component/ComponentManipulator";
import { sleep } from "util/Async";
import { Box } from "util/math/Geometry";
import Translation from "util/string/Translation";

export default class Component {
	public static window = {
		get listeners (): EventListenerManipulator<(typeof Component)["window"]> {
			Object.defineProperty(this, "listeners", {
				value: new EventListenerManipulator(this, () => window),
			});

			return this.listeners;
		},
	};

	private static map = new Map<Element, Component>();

	public static get<C extends Component = Component> (element: Element | Event) {
		if ("target" in element) {
			element = element.target as Element;
		}

		return (Component.map.get(element) || new Component(element)) as C;
	}

	public readonly attributes: AttributeManipulator<this>;
	public readonly classes: ClassManipulator<this>;
	public readonly data: DataManipulator<this>;
	public readonly style: StyleManipulator<this>;
	public readonly listeners: EventListenerManipulator<this>;

	public get id () { return this.element().id; }

	public get isRemoved () { return !this.internalElement; }

	protected textGenerator: () => string | number;

	private readonly internalElement: HTMLElement | undefined;

	private observerForRemoval: MutationObserver;

	public constructor(element: Element);
	public constructor(tagType: string);
	public constructor();
	public constructor(element: string | Element = "div") {
		this.internalElement = typeof element === "string" ? document.createElement(element) : element as HTMLElement;

		if (Component.map.get(this.internalElement)) {
			console.error(this.internalElement);
			throw new Error("Element is already registered to a Component.");
		}

		Component.map.set(this.internalElement, this);

		this.attributes = new AttributeManipulator(this, () => this.element());
		this.classes = new ClassManipulator(this, () => this.element());
		this.data = new DataManipulator(this, () => this.element());
		this.style = new StyleManipulator(this, () => this.element());
		this.listeners = new EventListenerManipulator(this, () => this.element());

		this.classes.add("component");

		if (this.element().parentElement) {
			this.bindObserverForRemoval();
		}

		this.listeners.add("remove", () => {
			Component.map.delete(this.element());
			if (this.observerForRemoval) this.observerForRemoval.disconnect();
		});
	}

	public element<H extends HTMLElement = HTMLElement> (): H {
		if (this.internalElement) return this.internalElement as H;

		console.error(this.internalElement);
		throw new Error("Element has already been removed. Removal is permanent.");
	}

	public setId (id: string) {
		this.element().id = id;
		return this;
	}

	public setText (translation: string | Translation<string> | (() => string | number)) {
		if (typeof translation === "string") translation = new Translation(translation);
		this.textGenerator = translation instanceof Translation ? translation.get : translation;
		this.refreshText();
		return this;
	}

	public refreshText () {
		this.element().textContent = this.textGenerator ? `${this.textGenerator()}` : "";
		return this;
	}

	////////////////////////////////////
	// Visibility
	//

	public show () {
		this.classes.remove("hidden", "transparent");
		this.emit("show");
		return this;
	}

	public hide (transparent = false) {
		this.classes.remove("hidden", "transparent");
		this.classes.add(transparent ? "transparent" : "hidden");
		this.emit("hide");
		return this;
	}

	public toggle (visible = !this.classes.none("hidden", "transparent")) {
		this.classes.remove("transparent");
		this.classes.toggle(!visible, "hidden");
		this.emit(visible ? "show" : "hide");
		return this;
	}

	////////////////////////////////////
	// Interelement Location
	//

	public appendTo (where: Component) {
		where.element().appendChild(this.element());
		this.bindObserverForRemoval();
		return this;
	}

	public append (...what: Component[]) {
		for (const component of what) {
			component.appendTo(this);
		}

		return this;
	}

	public remove () {
		this.element().remove();
	}

	public dump () {
		while (this.element().lastChild) {
			this.element().removeChild(this.element().lastChild!);
		}
	}

	public get parent () {
		return this.element().parentElement && Component.get(this.element().parentElement!);
	}

	public get childCount () {
		return this.element().childElementCount;
	}

	public *children<C extends Component = Component> (start = 0, end = Infinity, step = 1) {
		if (start < 0) start = this.element().children.length + start; // negative start

		if (start < 0) return; // no elements

		if (end < 0) end = this.element().children.length + end; // negative end

		end = Math.min(this.element().children.length, end);

		step = Math.round(step);
		step = step === 0 ? 1 : step;

		const stepSign = Math.sign(step);
		for (let i = start; Math.sign(end - i) === stepSign; i += step) {
			yield Component.get(this.element().children[i]);
		}
	}

	public child<C extends Component = Component> (n: number): C | undefined {
		if (n < 0) n = this.element().children.length + n; // negative index

		return this.element().children[n] && Component.get<C>(this.element().children[n]);
	}

	public *descendants<C extends Component = Component> (selector: string) {
		const first = this.element().querySelector(selector);
		if (!first) return;

		yield Component.get<C>(first);

		const all = this.element().querySelectorAll(selector);
		for (let i = 1; i < all.length; i++) {
			yield Component.get<C>(all[i]);
		}
	}

	public *ancestors<C extends Component = Component> (selector: string) {
		let match: Element | null = this.element();
		while (true) {
			match = match.parentElement && match.parentElement.closest(selector);
			if (!match) return;

			yield Component.get<C>(match);
		}
	}

	////////////////////////////////////
	// Misc
	//

	public emit<D = any> (event: string | Event, manipulator?: (event: ComponentEvent<D>) => any) {
		event = typeof event === "string" ? new Event(event) : event;
		if (manipulator) manipulator(event as ComponentEvent);
		return this.element().dispatchEvent(event);
	}

	public box () {
		return new Box(this.element().getBoundingClientRect());
	}

	public click () {
		this.element().click();
	}

	public schedule (handler: (component: this) => any): this;
	public schedule<_A> (handler: (component: this, _1: _A) => any, _1: _A): this;
	public schedule<_A, _B> (handler: (component: this, _1: _A, _2: _B) => any, _1: _A, _2: _B): this;
	public schedule<_A, _B, _C> (handler: (component: this, _1: _A, _2: _B, _3: _C) => any, _1: _A, _2: _B, _3: _C): this;
	public schedule<_A, _B, _C, _D> (handler: (component: this, _1: _A, _2: _B, _3: _C, _4: _D) => any, _1: _A, _2: _B, _3: _C, _4: _D): this;
	public schedule<_A, _B, _C, _D, _E> (handler: (component: this, _1: _A, _2: _B, _3: _C, _4: _D, _5: _E) => any, _1: _A, _2: _B, _3: _C, _4: _D, _5: _E): this;
	// public schedule (handler: (component: this, ...args: any[]) => any, ...args: any[]): this;
	public schedule (s: number, handler: (component: this) => any): this;
	public schedule<_A> (s: number, handler: (component: this, _1: _A) => any, _1: _A): this;
	public schedule<_A, _B> (s: number, handler: (component: this, _1: _A, _2: _B) => any, _1: _A, _2: _B): this;
	public schedule<_A, _B, _C> (s: number, handler: (component: this, _1: _A, _2: _B, _3: _C) => any, _1: _A, _2: _B, _3: _C): this;
	public schedule<_A, _B, _C, _D> (s: number, handler: (component: this, _1: _A, _2: _B, _3: _C, _4: _D) => any, _1: _A, _2: _B, _3: _C, _4: _D): this;
	public schedule<_A, _B, _C, _D, _E> (s: number, handler: (component: this, _1: _A, _2: _B, _3: _C, _4: _D, _5: _E) => any, _1: _A, _2: _B, _3: _C, _4: _D, _5: _E): this;
	// public schedule (s: number, handler: (component: this, ...args: any[]) => any, ...args: any[]): this;
	public schedule (s: ((component: this, ...args: any[]) => any) | number, handler?: any, ...args: any[]) {
		if (typeof s !== "number") handler = s, s = 0;
		sleep(s).then(() => handler(this, ...args));
		return this;
	}

	/**
	 * Creates a MutationObserver and attaches it to this component's element's parent. Whenever
	 * the parent element's children changes, this component checks if it has a valid parent. If
	 * it does not, it triggers the "remove" event on it, and any component descendants.
	 */
	private bindObserverForRemoval () {
		if (this.observerForRemoval) {
			this.observerForRemoval.disconnect();
		}

		if (!this.element().parentElement) {
			throw new Error("Cannot bind removal observer, there is no parent element.");
		}

		this.observerForRemoval = new MutationObserver(() => {
			if (!this.element().parentElement) {
				this.element().dispatchEvent(new Event("remove"));

				for (const descendant of this.element().getElementsByClassName("component")) {
					descendant.dispatchEvent(new Event("remove"));
				}
			}
		});

		this.observerForRemoval.observe(this.element().parentElement!, { childList: true });
	}
}
