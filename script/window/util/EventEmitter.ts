// tslint:disable max-line-length

import PriorityMap from "util/PriorityMap";

const SYMBOL_SUBSCRIPTIONS = Symbol("subscriptions");

export type Events<T> =
	T extends EventEmitterHost<infer E> ? E :
	// tslint:disable-next-line no-shadowed-variable https://github.com/palantir/tslint/issues/4235
	T extends EventEmitterHostClass<infer E> ? E : never;

class EventEmitter<H, E> implements IEventEmitter<H, E> {

	private readonly hostClass: TrueEventEmitterHostClass<E>;
	private readonly subscriptions = new Map<keyof E, PriorityMap<Set<IterableOr<Handler<any, any>>>>>();

	public constructor (private readonly host: H) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const h = host as any;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		this.hostClass = h.constructor;
		if (!(SYMBOL_SUBSCRIPTIONS in this.hostClass)) {
			this.hostClass[SYMBOL_SUBSCRIPTIONS] = new Map();
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if ("event" in host && h.event instanceof EventEmitter) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
			this.copyFrom(h.event);
		}

		if (SYMBOL_SUBSCRIPTIONS in h) {
			const subscriptions = (h as SelfSubscribedEmitter<E>)[SYMBOL_SUBSCRIPTIONS];
			for (const [selfSubscribedHost, event, handlerMethodName, priority] of subscriptions) {
				if (h instanceof selfSubscribedHost.constructor) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
					this.subscribe(event, (_: any, ...args: any[]) => (h as any)[handlerMethodName](...args), priority);
				}
			}

			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			delete h[SYMBOL_SUBSCRIPTIONS];
		}
	}

	public copyFrom (emitter: IEventEmitter<H, E>) {
		(emitter as EventEmitter<H, E>).subscriptions.entryStream().toMap(this.subscriptions);
	}

	// public arguments<K extends keyof E>(event: K): ArgsOf<E[K]> {
	// 	throw new Error("This method does not exist.");
	// }

	public emit<K extends keyof E> (event: K, ...args: ArgsOf<E[K]>) {
		this.emitStream(event, ...args).complete();
		return this.host;
	}

	public emitStream<K extends keyof E> (event: K, ...args: ArgsOf<E[K]>): Stream<ReturnOf<E[K]>> {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return Stream.of(this.subscriptions, this.hostClass[SYMBOL_SUBSCRIPTIONS])
			.map(subscriptionMap => subscriptionMap.getOrDefault(event, () => new PriorityMap()))
			.splat(PriorityMap.streamAll)
			.flatMap()
			.flatMap()
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			.map(subscriber => subscriber(this.host, ...args));
	}

	public emitReduce<K extends keyof E, A extends ReturnOf<E[K]> & Head<ArgsOf<E[K]>>> (event: K, arg: A, ...args: Tail<ArgsOf<E[K]>>): Extract<ReturnOf<E[K]> & Head<ArgsOf<E[K]>>, undefined> extends undefined ? (undefined extends A ? ReturnOf<E[K]> : A) : ReturnOf<E[K]> {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return Stream.of(this.subscriptions, this.hostClass[SYMBOL_SUBSCRIPTIONS])
			.map(subscriptionMap => subscriptionMap.getOrDefault(event, () => new PriorityMap()))
			.splat(PriorityMap.streamAll)
			.flatMap()
			.flatMap()
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			.fold(arg, (current, handler) => handler(current, ...args)) as any;
		// we have to cast to any because typescript updated and decided that `A` was no longer good enough here~
	}

	public async emitAsync<K extends keyof E> (event: K, ...args: ArgsOf<E[K]>): Promise<any> {
		return this.emitStream(event, ...args).rest();
	}

	public subscribe<K extends ArrayOr<keyof E>> (events: K, handler: IterableOr<Handler<H, K extends any[] ? E[K[number]] : E[Extract<K, keyof E>]>>, priority = 0) {
		for (const event of Array.isArray(events) ? events : [events]) {
			this.subscriptions.getOrDefault(event, () => new PriorityMap(), true)
				.getOrDefault(priority, () => new Set(), true)
				.add(handler);
		}

		return this.host;
	}

	public unsubscribe<K extends ArrayOr<keyof E>> (events: K, handler: IterableOr<Handler<H, K extends any[] ? E[K[number]] : E[Extract<K, keyof E>]>>, priority = 0) {
		return (Array.isArray(events) ? events : [events]).stream()
			.map(event => this.subscriptions.getOrDefault(event, () => new PriorityMap())
				.getOrDefault(priority, () => new Set())
				.delete(handler))
			.toArray()
			.includes(true);
	}

	public async waitFor<K extends ArrayOr<keyof E>> (events: K, priority = 0): Promise<ArgsOf<K extends any[] ? E[K[number]] : E[Extract<K, keyof E>]>> {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return new Promise<any>(resolve => {
			const realHandler: AnyFunction = (host: any, ...args: any[]) => {
				this.unsubscribe(events, realHandler, priority);
				resolve(args as any);
			};

			this.subscribe(events, realHandler, priority);
		});
	}

	public until<E2> (emitter: EventEmitterHost<E2>, ...events: (keyof E2)[]): UntilSubscriber<H, E>;
	public until (promise: Promise<any>): UntilSubscriber<H, E>;
	public until (promiseOrEmitter: Promise<any> | EventEmitterHost<any>, ...events: (string | number | symbol)[]): UntilSubscriber<H, E> {
		if ("event" in promiseOrEmitter) {
			promiseOrEmitter = events.stream()
				.map(event => (promiseOrEmitter as EventEmitterHost<any>).event.waitFor(event))
				.race();
		}

		return {
			subscribe: <K extends ArrayOr<keyof E>> (event: K, handler: IterableOr<Handler<H, K extends any[] ? E[K[number]] : E[Extract<K, keyof E>]>>, priority = 0) => {
				this.subscribe(event, handler, priority);

				void (promiseOrEmitter as Promise<any>).then(() => {
					this.unsubscribe(event, handler, priority);
				});

				return this.host;
			},
		};
	}
}

namespace EventEmitter {
	export class Host<E> implements EventEmitterHost<E> {
		public readonly event: IEventEmitter<this, E> = new EventEmitter<this, E>(this);
	}
}

export default EventEmitter;


const SYMBOL_EVENT_HANDLERS = Symbol("event handlers");

interface EventSubscriberClass extends NullaryClass<any> {
	[SYMBOL_EVENT_HANDLERS]: [EventEmitterHostClass<any>, string | number | symbol, number, EventSubscriberClass, string | number | symbol][];
}

type ReturnTypeLenient<T extends AnyFunction> =
	ReturnType<T> extends void ? Promise<void> : ReturnType<T>;

type TypedPropertyDescriptorFunctionAnyNOfParams<T extends AnyFunction> =
	TypedPropertyDescriptor<(...args: ArgumentsOf<T>) => ReturnTypeLenient<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1], a2: ArgumentsOf<T>[2], a3: ArgumentsOf<T>[3], a4: ArgumentsOf<T>[4], a5: ArgumentsOf<T>[5], a6: ArgumentsOf<T>[6], a7: ArgumentsOf<T>[7], a8: ArgumentsOf<T>[8], a9: ArgumentsOf<T>[9]) => ReturnTypeLenient<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1], a2: ArgumentsOf<T>[2], a3: ArgumentsOf<T>[3], a4: ArgumentsOf<T>[4], a5: ArgumentsOf<T>[5], a6: ArgumentsOf<T>[6], a7: ArgumentsOf<T>[7], a8: ArgumentsOf<T>[8]) => ReturnTypeLenient<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1], a2: ArgumentsOf<T>[2], a3: ArgumentsOf<T>[3], a4: ArgumentsOf<T>[4], a5: ArgumentsOf<T>[5], a6: ArgumentsOf<T>[6], a7: ArgumentsOf<T>[7]) => ReturnTypeLenient<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1], a2: ArgumentsOf<T>[2], a3: ArgumentsOf<T>[3], a4: ArgumentsOf<T>[4], a5: ArgumentsOf<T>[5], a6: ArgumentsOf<T>[6]) => ReturnTypeLenient<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1], a2: ArgumentsOf<T>[2], a3: ArgumentsOf<T>[3], a4: ArgumentsOf<T>[4], a5: ArgumentsOf<T>[5]) => ReturnTypeLenient<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1], a2: ArgumentsOf<T>[2], a3: ArgumentsOf<T>[3], a4: ArgumentsOf<T>[4]) => ReturnTypeLenient<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1], a2: ArgumentsOf<T>[2], a3: ArgumentsOf<T>[3]) => ReturnTypeLenient<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1], a2: ArgumentsOf<T>[2]) => ReturnTypeLenient<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1]) => ReturnTypeLenient<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0]) => ReturnTypeLenient<T>> |
	TypedPropertyDescriptor<() => ReturnTypeLenient<T>> |
	TypedPropertyDescriptor<T> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1], a2: ArgumentsOf<T>[2], a3: ArgumentsOf<T>[3], a4: ArgumentsOf<T>[4], a5: ArgumentsOf<T>[5], a6: ArgumentsOf<T>[6], a7: ArgumentsOf<T>[7], a8: ArgumentsOf<T>[8], a9: ArgumentsOf<T>[9]) => ReturnType<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1], a2: ArgumentsOf<T>[2], a3: ArgumentsOf<T>[3], a4: ArgumentsOf<T>[4], a5: ArgumentsOf<T>[5], a6: ArgumentsOf<T>[6], a7: ArgumentsOf<T>[7], a8: ArgumentsOf<T>[8]) => ReturnType<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1], a2: ArgumentsOf<T>[2], a3: ArgumentsOf<T>[3], a4: ArgumentsOf<T>[4], a5: ArgumentsOf<T>[5], a6: ArgumentsOf<T>[6], a7: ArgumentsOf<T>[7]) => ReturnType<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1], a2: ArgumentsOf<T>[2], a3: ArgumentsOf<T>[3], a4: ArgumentsOf<T>[4], a5: ArgumentsOf<T>[5], a6: ArgumentsOf<T>[6]) => ReturnType<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1], a2: ArgumentsOf<T>[2], a3: ArgumentsOf<T>[3], a4: ArgumentsOf<T>[4], a5: ArgumentsOf<T>[5]) => ReturnType<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1], a2: ArgumentsOf<T>[2], a3: ArgumentsOf<T>[3], a4: ArgumentsOf<T>[4]) => ReturnType<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1], a2: ArgumentsOf<T>[2], a3: ArgumentsOf<T>[3]) => ReturnType<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1], a2: ArgumentsOf<T>[2]) => ReturnType<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0], a1: ArgumentsOf<T>[1]) => ReturnType<T>> |
	TypedPropertyDescriptor<(a0: ArgumentsOf<T>[0]) => ReturnType<T>> |
	TypedPropertyDescriptor<() => ReturnType<T>>;

export function EventHandler<T extends EventEmitterHost<any>> (injectInto: "self"): <P extends keyof Events<T>>(property: P, priority?: number) => (host: T, property2: string | number | symbol, descriptor: TypedPropertyDescriptorFunctionAnyNOfParams<Events<T>[P]>) => void;
export function EventHandler<T extends EventEmitterHostClass<any>> (cls: T): <P extends keyof Events<T>>(property: P, priority?: number) => (host: any, property2: string | number | symbol, descriptor: TypedPropertyDescriptorFunctionAnyNOfParams<Handler<HostFromHostOrHostClass<T>, Events<T>[P]>>) => void;
export function EventHandler (injectInto: "self" | AnyClass<EventEmitterHost<any>>): (property: string, priority?: number) => (host: any, property2: string | number | symbol, descriptor: TypedPropertyDescriptor<any>) => void {
	return (property: string | symbol | number, priority = 0) =>
		<T extends { [key in P]: AnyFunction }, P extends string | number | symbol> (host: T, property2: P, descriptor: any) => {
			if (injectInto === "self") {
				const host1 = host as T & SelfSubscribedEmitter<any>;
				if (!(SYMBOL_SUBSCRIPTIONS in host1)) {
					host1[SYMBOL_SUBSCRIPTIONS] = [];
				}

				host1[SYMBOL_SUBSCRIPTIONS].push([host1, property, property2, priority]);

			} else {
				const hostClass = host.constructor as EventSubscriberClass;
				const eventHandlers = hostClass[SYMBOL_EVENT_HANDLERS] = hostClass[SYMBOL_EVENT_HANDLERS] || [];
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				eventHandlers.push([injectInto as any, property, priority, hostClass, property2]);

			}
		};
}


type HostFromHostOrHostClass<H extends EventEmitterHost<any> | EventEmitterHostClass<any>> =
	H extends EventEmitterHost<any> ? H : InstanceOf<Extract<H, EventEmitterHostClass<any>>>;

interface EventEmitterHost<E> {
	event: IEventEmitter<this, E>;
}

type EventEmitterHostClass<E> = Class<EventEmitterHost<E>>;

interface TrueEventEmitterHostClass<E> extends Class<any> {
	[SYMBOL_SUBSCRIPTIONS]: Map<keyof E, PriorityMap<Set<IterableOr<Handler<any, any>>>>>;
}

interface SelfSubscribedEmitter<E> {
	[SYMBOL_SUBSCRIPTIONS]: [SelfSubscribedEmitter<any>, keyof E, string | number | symbol, number?][];
}

type ArgsOf<F> = ArgumentsOf<Extract<F, AnyFunction>>;
type ReturnOf<F> = ReturnType<Extract<F, AnyFunction>>;
type Handler<H, F> = (host: H, ...args: ArgsOf<F>) => ReturnOf<F>;

interface UntilSubscriber<H, E> {
	subscribe<K extends ArrayOr<keyof E>> (event: K, handler: IterableOr<Handler<H, K extends any[] ? E[K[number]] : E[Extract<K, keyof E>]>>, priority?: number): H;
}

// this is the last in the file because for some reason it breaks the syntax highlighter ¯\_(ツ)_/¯

// tslint:disable-next-line interface-name
export interface IEventEmitter<H = any, E = any> {
	// copyFrom (emitter: IEventEmitter<H, E>): void;
	emit<K extends keyof E> (event: K, ...args: ArgsOf<E[K]>): H;
	emitStream<K extends keyof E> (event: K, ...args: ArgsOf<E[K]>): Stream<ReturnOf<E[K]>>;
	emitReduce<K extends keyof E, A extends ReturnOf<E[K]> & Head<ArgsOf<E[K]>>> (event: K, arg: A, ...args: Tail<ArgsOf<E[K]>>): Extract<ReturnOf<E[K]> & Head<ArgsOf<E[K]>>, undefined> extends undefined ? (undefined extends A ? ReturnOf<E[K]> : A) : ReturnOf<E[K]>;
	emitAsync<K extends keyof E> (event: K, ...args: ArgsOf<E[K]>): Promise<Stream<(Extract<ReturnOf<E[K]>, Promise<any>> extends Promise<infer R> ? R : never) | Exclude<ReturnOf<E[K]>, Promise<any>>>>;
	subscribe<K extends ArrayOr<keyof E>> (event: K, handler: IterableOr<Handler<H, K extends any[] ? E[K[number]] : E[Extract<K, keyof E>]>>, priority?: number): H;
	unsubscribe<K extends ArrayOr<keyof E>> (event: K, handler: IterableOr<Handler<H, K extends any[] ? E[K[number]] : E[Extract<K, keyof E>]>>, priority?: number): boolean;
	waitFor<K extends ArrayOr<keyof E>> (events: K, priority?: number): Promise<ArgsOf<K extends any[] ? E[K[number]] : E[Extract<K, keyof E>]>>;
	until<E2> (emitter: EventEmitterHost<E2>, ...events: (keyof E2)[]): UntilSubscriber<H, E>;
	until (promise: Promise<any>): UntilSubscriber<H, E>;
}
