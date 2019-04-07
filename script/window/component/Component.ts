import { AttributeManipulator, ClassManipulator, ComponentEvent, DataManipulator, EventListenerManipulator, StyleManipulator } from "component/ComponentManipulator";
import { sleep } from "util/Async";
import { Box } from "util/math/Geometry";
import Stream from "util/stream/Stream";
import Translation from "util/string/Translation";

/**
 * If string, used as a translation key.
 * If a function, not used as a key.
 */
export type TextGenerator = string | Translation<string> | (() => string | number);

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

	public static get<C extends Component = Component> (element: Element | Event | string) {
		if (typeof element === "string") {
			element = document.querySelector(element)!;
		}

		if ("target" in element) {
			element = element.target as Element;
		}

		return (Component.map.get(element) || new Component(element)) as C;
	}

	public static all<C extends Component = Component> (selector: string) {
		return Stream.from(document.querySelectorAll(selector))
			.map(element => (Component.map.get(element) || new Component(element)) as C);
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

	public constructor (element: Element);
	public constructor (tagType?: string);
	public constructor ();
	public constructor (element: string | Element = "div") {
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

	public setText (translation: TextGenerator) {
		if (typeof translation === "string") translation = new Translation(translation);
		this.textGenerator = translation instanceof Translation ? translation.get : translation;
		this.refreshText();
		return this;
	}

	@Bound public refreshText () {
		const text = this.textGenerator ? this.textGenerator() as any : "";
		this.element().textContent = text === null || text === undefined ? "" : `${text}`;
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

	public appendTo (parent: Component, location: "beginning" | "end" | { before: Component | Node } = "end") {
		parent.emit("append-child", event => event.data = this);
		const parentElement = parent.element();
		if (location === "end" || !parentElement.firstChild) parentElement.appendChild(this.element());
		else {
			if (location === "beginning") location = { before: parentElement.firstChild };
			parentElement.insertBefore(this.element(), location.before instanceof Component ? location.before.element() : location.before);
		}

		this.bindObserverForRemoval();
		return this;
	}

	public append (...what: ArrayOfIterablesOr<Component | undefined>) {
		for (const component of what.stream().flatMap()) {
			if (component) component.appendTo(this);
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

		return this;
	}

	public get parent () {
		return this.element().parentElement && Component.get(this.element().parentElement!);
	}

	public get childCount () {
		return this.element().childElementCount;
	}

	public children<C extends Component = Component> (step = 1) {
		return Array.from(this.element().children)
			.stream(step)
			.map(child => Component.get<C>(child));
	}

	public child<C extends Component = Component> (n: number): C | undefined {
		if (n < 0) n = this.element().children.length + n; // negative index

		return this.element().children[n] && Component.get<C>(this.element().children[n]);
	}

	public descendants<C extends Component = Component> (selector: string) {
		return Stream.from(this.element().querySelectorAll(selector))
			.map(descendant => Component.get<C>(descendant));
	}

	public *ancestors<C extends Component = Component> (selector: string) {
		let match: Element | null = this.element();
		while (true) {
			match = match.parentElement && match.parentElement.closest(selector);
			if (!match) return;

			yield Component.get<C>(match);
		}
	}

	public siblings<C extends Component = Component> () {
		if (!this.parent) return Stream.empty;
		return this.parent.children<C>()
			.filter(c => c !== this as any);
	}

	public isDescendantOf (component: Component) {
		return component.element().contains(this.element());
	}

	public hasDescendants (...components: Component[]) {
		for (const component of components) {
			if (!component.isDescendantOf(this)) return false;
		}

		return true;
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

	public focus () {
		this.element().focus();
		return this;
	}

	public click () {
		this.element().click();
		return this;
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
		if (typeof s !== "number") args.unshift(handler), s(this, ...args);
		else sleep(s).then(() => handler(this, ...args));
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
