const SYMBOL_TRIGGER_FIELDS = Symbol("TRIGGER_FIELDS");
const SYMBOL_NON_PROXY_STORAGE = Symbol("NON_PROXY_STORAGE");

interface TriggerHandlerClass {
	[SYMBOL_TRIGGER_FIELDS]: Map<any, (string | number | symbol)[]>;
}

export function Triggers (host: any, property: string | number | symbol) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	const h = host.constructor as TriggerHandlerClass;
	(h[SYMBOL_TRIGGER_FIELDS] = h[SYMBOL_TRIGGER_FIELDS] || new Map())
		.getOrDefault(h, () => [], true)
		.push(property);
}

export namespace Triggers {
	export function get<T extends object> (inst: T): (keyof T)[] {
		const h = inst.constructor as any as TriggerHandlerClass;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return (h[SYMBOL_TRIGGER_FIELDS] || new Map())
			.getOrDefault(h, () => []) as any;
	}

	export function getNonProxyValue<T, P extends keyof T> (inst: T, prop: P): T[P] {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		const nonProxyStorage = (inst as any)[SYMBOL_NON_PROXY_STORAGE];
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
		return nonProxyStorage && nonProxyStorage[prop];
	}
}

export function TriggerHandler<M extends string | number | symbol> (method: M) {
	// tslint:disable-next-line ban-types
	return <C extends Function & { prototype: { [key in M]: (...args: any[]) => any } }> (constructor: C): C => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return class extends (constructor as any) {

			private [SYMBOL_NON_PROXY_STORAGE]: any = {};

			public constructor (...args: any[]) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call
				super(...args);
				const host = this.constructor as any as TriggerHandlerClass;
				for (const [hostClass, triggers] of host[SYMBOL_TRIGGER_FIELDS] || new Map()) {
					if (this instanceof hostClass) {
						for (const property of triggers) {
							// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
							let baseValue = this[SYMBOL_NON_PROXY_STORAGE][property] = this[property as keyof this];
							let value: any | undefined;
							Object.defineProperty(this, property, {
								get () {
									if (value === undefined) {
										// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
										value = proxy(baseValue, () => (this[method])(value, property));
									}
									// eslint-disable-next-line @typescript-eslint/no-unsafe-return
									return value;
								},
								set (newValue: any) {
									// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
									baseValue = this[SYMBOL_NON_PROXY_STORAGE][property] = newValue;
									value = undefined;
									// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,  @typescript-eslint/no-unsafe-call
									(this[method])(newValue, property);
								},
							});
						}
					}
				}
			}
		} as any;
	};
}

function proxy<T> (value: T, onChange: () => any): T {
	if (typeof value !== "object") return value;

	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return new Proxy(value as Extract<T, object>, {
		get (target: any, prop: string | symbol | number) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return,  @typescript-eslint/no-unsafe-member-access
			return proxy(target[prop], onChange);
		},
		set (target: any, prop: string | symbol | number, newValue: any) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
			target[prop] = newValue;
			onChange();
			return true;
		},
	});
}
