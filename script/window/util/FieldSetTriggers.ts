const SYMBOL_TRIGGER_FIELDS = Symbol("TRIGGER_FIELDS");
const SYMBOL_NON_PROXY_STORAGE = Symbol("NON_PROXY_STORAGE");

interface TriggerHandlerClass {
	[SYMBOL_TRIGGER_FIELDS]: Map<any, (string | number | symbol)[]>;
}

export function Triggers (host: any, property: string | number | symbol) {
	const h = host.constructor as TriggerHandlerClass;
	(h[SYMBOL_TRIGGER_FIELDS] = h[SYMBOL_TRIGGER_FIELDS] || new Map())
		.getOrDefault(h, () => [], true)
		.push(property);
}

export module Triggers {
	export function get<T extends object> (inst: T): (keyof T)[] {
		const h = inst.constructor as any as TriggerHandlerClass;
		return (h[SYMBOL_TRIGGER_FIELDS] || new Map())
			.getOrDefault(h, () => []) as any;
	}

	export function getNonProxyValue<T, P extends keyof T> (inst: T, prop: P): T[P] {
		const nonProxyStorage = (inst as any)[SYMBOL_NON_PROXY_STORAGE];
		return nonProxyStorage && nonProxyStorage[prop];
	}
}

export function TriggerHandler<M extends string | number | symbol> (method: M) {
	// tslint:disable-next-line ban-types
	return <C extends Function & { prototype: { [key in M]: (...args: any[]) => any } }> (constructor: C): C => {
		return class extends (constructor as any) {

			private [SYMBOL_NON_PROXY_STORAGE]: any = {};

			public constructor (...args: any[]) {
				super(...args);
				const host = this.constructor as any as TriggerHandlerClass;
				for (const [hostClass, triggers] of host[SYMBOL_TRIGGER_FIELDS] || new Map()) {
					if (this instanceof hostClass) {
						for (const property of triggers) {
							let baseValue = this[SYMBOL_NON_PROXY_STORAGE][property] = this[property as keyof this];
							let value: any | undefined;
							Object.defineProperty(this, property, {
								get () {
									if (value === undefined) {
										value = proxy(baseValue, () => (this[method] as any)(value, property));
									}
									return value;
								},
								set (newValue: any) {
									baseValue = this[SYMBOL_NON_PROXY_STORAGE][property] = newValue;
									value = undefined;
									(this[method] as any)(newValue, property);
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

	return new Proxy(value as Extract<T, object>, {
		get (target: any, prop: string | symbol | number) {
			return proxy(target[prop], onChange);
		},
		set (target: any, prop: string | symbol | number, newValue: any) {
			target[prop] = newValue;
			onChange();
			return true;
		},
	});
}
