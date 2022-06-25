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

export interface EventEmitter {
	addEventListener (type: string, listener: (evt: Event) => any, options?: boolean | AddEventListenerOptions): void;
	removeEventListener (type: string, listener: (evt: Event) => any, options?: boolean | EventListenerOptions): void;
}

export abstract class Manipulator<T, U extends Until<T> | undefined = undefined> {
	protected readonly element: () => EventEmitter;
	protected readonly host: T;

	protected untilHandler?: UntilHandler<T, EmptyIfUndefined<U>>;

	public constructor (host: T, element: () => EventEmitter) {
		this.host = host;
		this.element = element;
	}

	public until (promise: Promise<any>): EmptyIfUndefined<U>;
	public until (s: number): EmptyIfUndefined<U>;
	public until (s: number | Promise<any>): EmptyIfUndefined<U> {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		if (!this.untilHandler) return {} as any;

		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return new Proxy({}, {
			get: (_, k: any) => (...args: any[]) => {
				const key = k as keyof EmptyIfUndefined<U>;
				const { start, end } = this.untilHandler![key] as any as Until<T>;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				start(...args);

				const promise = typeof s === "number" ? sleep(s) : s;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				void promise.then(() => end(...args));

				return this.host;
			},
		}) as any;
	}
}

export interface ListenUntil<T> extends Until<T> {
	add<E extends Event = Event> (events: string | string[], callback: (event: E) => any): T;
}

export interface ComponentEvent<T = any> extends Event {
	data: T;
}

export class EventListenerManipulator<T> extends Manipulator<T, ListenUntil<T>> {
	protected override untilHandler = {
		add: {
			start: <E extends Event = ComponentEvent> (events: string | string[], callback: (event: E) => any) => this.add(events, callback),
			end: <E extends Event = ComponentEvent> (events: string | string[], callback: (event: E) => any) => this.remove(events, callback),
		},
	};

	public constructor (host: T, element: () => EventEmitter) {
		super(host, element);
	}

	public override until (event: string): EmptyIfUndefined<ListenUntil<T>>;
	public override until (promise: Promise<any>): EmptyIfUndefined<ListenUntil<T>>;
	public override until (s: number): EmptyIfUndefined<ListenUntil<T>>;
	public override until (s: number | string | Promise<any>): EmptyIfUndefined<ListenUntil<T>> {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		if (!this.untilHandler) return {} as any;

		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return new Proxy({}, {
			get: (_, key: keyof EventListenerManipulator<T>["untilHandler"]) => (...args: any[]) => {
				const { start, end } = this.untilHandler[key] as any as Until<T>;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				start(...args);

				const promise = typeof s === "number" ? sleep(s) : typeof s === "string" ? this.waitFor(s) : s;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				void promise.then(() => end(...args));

				return this.host;
			},
		}) as any;
	}

	public add<E extends Event = ComponentEvent> (events: string | string[], callback: (event: E) => any) {
		if (!Array.isArray(events)) events = [events];

		for (const event of events) {
			this.element().addEventListener(event, callback as (event: Event) => any);
		}

		return this.host;
	}

	public remove<E extends Event = ComponentEvent> (events: string | string[], callback: (event: E) => any) {
		if (!Array.isArray(events)) events = [events];

		for (const event of events) {
			this.element().removeEventListener(event, callback as (event: Event) => any);
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
