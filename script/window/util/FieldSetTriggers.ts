const SYMBOL_TRIGGER_FIELDS = Symbol("TRIGGER_FIELDS");

interface TriggerHandlerClass {
	[SYMBOL_TRIGGER_FIELDS]: Map<any, (string | number | symbol)[]>;
}

export function Triggers (host: any, property: string | number | symbol) {
	const h = host.constructor as TriggerHandlerClass;
	(h[SYMBOL_TRIGGER_FIELDS] = h[SYMBOL_TRIGGER_FIELDS] || new Map())
		.getOrDefault(h, () => [], true)
		.push(property);
}

export function TriggerHandler<M extends string | number | symbol> (method: M) {
	// tslint:disable-next-line ban-types
	return <C extends Function & { prototype: { [key in M]: (...args: any[]) => any } }> (constructor: C): C => {
		return class extends (constructor as any) {
			public constructor (...args: any[]) {
				super(...args);
				const host = this.constructor as any as TriggerHandlerClass;
				for (const [hostClass, triggers] of host[SYMBOL_TRIGGER_FIELDS] || new Map()) {
					if (this instanceof hostClass) {
						for (const property of triggers) {
							let baseValue = this[property as keyof this];
							let value: any | undefined;
							Object.defineProperty(this, property, {
								get () {
									if (value === undefined) {
										value = proxy(baseValue, () => (this[method] as any)(value, property));
									}
									return value;
								},
								set (newValue: any) {
									baseValue = newValue;
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
