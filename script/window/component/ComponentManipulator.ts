import { sleep } from "util/Async";

export interface Until<T> {
	[key: string]: (...args: any[]) => T;
}

export type UntilHandler<T, U extends Until<T>> = {
	[key in keyof U]: {
		start: U[key];
		end: U[key];
	};
};

type EmptyIfUndefined<T> = T extends undefined ? {} : T;

export abstract class Manipulator<T, U extends Until<T> | undefined = undefined> {
	protected readonly element: () => HTMLElement;
	protected readonly host: T;

	protected untilHandler?: UntilHandler<T, EmptyIfUndefined<U>>;

	public constructor (host: T, element: () => HTMLElement) {
		this.host = host;
		this.element = element;
	}

	public until (promise: Promise<any>): EmptyIfUndefined<U>;
	public until (s: number): EmptyIfUndefined<U>;
	public until (s: number | Promise<any>): EmptyIfUndefined<U> {
		if (!this.untilHandler) return {} as any;

		return new Proxy({}, {
			get: (_, key: keyof EmptyIfUndefined<U>) => (...args: any[]) => {
				const { start, end } = this.untilHandler![key] as any as Until<T>;
				start(...args);

				const promise = typeof s === "number" ? sleep(s) : s;
				promise.then(() => end(...args));

				return this.host;
			},
		}) as any;
	}
}

export interface ClassUntil<T> extends Until<T> {
	add (...classes: string[]): T;
	remove (...classes: string[]): T;
	toggle (hasClass: boolean, ...classes: string[]): T;
}

export class ClassManipulator<T> extends Manipulator<T, ClassUntil<T>> {
	@Override protected untilHandler = {
		add: {
			start: (...classes: string[]) => this.add(...classes),
			end: (...classes: string[]) => this.remove(...classes),
		},
		remove: {
			start: (...classes: string[]) => this.remove(...classes),
			end: (...classes: string[]) => this.add(...classes),
		},
		toggle: {
			start: (hasClass: boolean, ...classes: string[]) => this.toggle(hasClass, ...classes),
			end: (hasClass: boolean, ...classes: string[]) => this.toggle(!hasClass, ...classes),
		},
	};

	public add (...classes: string[]) {
		this.element().classList.add(...classes);
		return this.host;
	}

	public remove (...classes: string[]) {
		this.element().classList.remove(...classes);
		return this.host;
	}

	public toggle (...classes: string[]): T;
	public toggle (hasClass: boolean, ...classes: string[]): T;
	public toggle (hasClass: boolean | string, ...classes: string[]) {
		if (typeof hasClass === "string") {
			for (const cls of [hasClass, ...classes]) {
				this.element().classList.toggle(cls);
			}

			return this.host;
		}

		if (hasClass) this.element().classList.add(...classes);
		else this.element().classList.remove(...classes);

		return this.host;
	}

	public has (...classes: string[]) {
		for (const cls of classes) {
			if (!this.element().classList.contains(cls)) return false;
		}

		return true;
	}

	public none (...classes: string[]) {
		for (const cls of classes) {
			if (this.element().classList.contains(cls)) return false;
		}

		return true;
	}
}

export interface AttributeUntil<T> extends Until<T> {
	set (attribute: string, value: string): T;
}

export class AttributeManipulator<T> extends Manipulator<T, AttributeUntil<T>> {
	@Override protected untilHandler = {
		set: {
			start: (attribute: string, value: string) => this.set(attribute, value),
			end: (attribute: string) => this.remove(attribute),
		},
	};

	public set (attribute: string, value = "") {
		this.element().setAttribute(attribute, value);
		return this.host;
	}

	public get<S extends string | null> (attribute: string): S {
		return this.element().getAttribute(attribute) as S;
	}

	public remove (attribute: string) {
		this.element().removeAttribute(attribute);
		return this.host;
	}

	public has (attribute: string) {
		return this.element().hasAttribute(attribute);
	}
}

export class DataManipulator<T> extends Manipulator<T> {
	public set (property: string, value: any) {
		this.element().dataset[property] = JSON.stringify(value);
		return this.host;
	}

	public get<R = string | undefined> (property: string) {
		return JSON.parse(this.element().dataset[property] || "null") as R;
	}

	public remove (property: string) {
		delete this.element().dataset[property];
		return this.host;
	}

	public has (attribute: string) {
		return this.element().dataset[attribute] !== undefined;
	}
}

export interface StyleUntil<T> extends Until<T> {
	set (rule: string, value: string): T;
}

export class StyleManipulator<T> extends Manipulator<T, StyleUntil<T>> {
	@Override protected untilHandler = {
		set: {
			start: (rule: string, value: string | number) => this.set(rule, value),
			end: (rule: string) => this.remove(rule),
		},
	};

	public set (rule: string, value: string | number) {
		this.element().style.setProperty(rule, `${value}`);
		return this.host;
	}

	public get (rule: string) {
		return getComputedStyle(this.element()).getPropertyValue(rule);
	}

	public remove (rule: string) {
		this.element().style.setProperty(rule, null);
		return this.host;
	}
}

export interface ListenUntil<T> extends Until<T> {
	add<E extends Event = Event> (events: string | string[], callback: (event: E) => any, always?: boolean): T;
}

export interface ComponentEvent<T = any> extends Event {
	data: T;
}

export class EventListenerManipulator<T> extends Manipulator<T, ListenUntil<T>> {
	@Override protected untilHandler = {
		add: {
			start: <E extends Event = ComponentEvent> (events: string | string[], callback: (event: E) => any) => this.add(events, callback),
			end: <E extends Event = ComponentEvent> (events: string | string[], callback: (event: E) => any) => this.remove(events, callback),
		},
	};

	public constructor (host: T, element: () => EventTarget) {
		super(host, element as any);
	}

	public until (event: string): EmptyIfUndefined<ListenUntil<T>>;
	public until (promise: Promise<any>): EmptyIfUndefined<ListenUntil<T>>;
	public until (s: number): EmptyIfUndefined<ListenUntil<T>>;
	@Override public until (s: number | string | Promise<any>): EmptyIfUndefined<ListenUntil<T>> {
		if (!this.untilHandler) return {} as any;

		return new Proxy({}, {
			get: (_, key: keyof EventListenerManipulator<T>["untilHandler"]) => (...args: any[]) => {
				const { start, end } = this.untilHandler[key] as any as Until<T>;
				start(...args);

				const promise = typeof s === "number" ? sleep(s) : typeof s === "string" ? this.waitFor(s) : s;
				promise.then(() => end(...args));

				return this.host;
			},
		}) as any;
	}

	public add<E extends Event = ComponentEvent> (events: string | string[], callback: (event: E) => any, always = false) {
		if (!Array.isArray(events)) events = [events];

		for (const event of events) {
			this.element().addEventListener(event, callback as any, always);
		}

		return this.host;
	}

	public remove<E extends Event = ComponentEvent> (events: string | string[], callback: (event: E) => any) {
		if (!Array.isArray(events)) events = [events];

		for (const event of events) {
			this.element().removeEventListener(event, callback as any);
		}

		return this.host;
	}

	public async waitFor (events: string | string[]) {
		return new Promise<void>(resolve => {
			let cb: () => void;
			this.add(events, cb = () => {
				this.remove(events, cb);
				resolve();
			});
		});
	}
}
