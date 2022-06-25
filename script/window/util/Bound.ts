declare global {
	const Bound: typeof BoundFn;
}

export default function ApplyBound () {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	(window as any).Bound = BoundFn;
}

function BoundFn<T extends (...args: any[]) => any>
	(target: any, key: string, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T> | void {

	let fn = descriptor.value;

	return {
		configurable: true,
		get () {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, no-prototype-builtins
			if (!this || this === target.prototype || this.hasOwnProperty(key) || typeof fn !== "function") {
				// console.log(target, key, descriptor, "early return");
				return fn!;
			}

			const boundFn = fn.bind(this) as T;
			Object.defineProperty(this, key, {
				configurable: true,
				get () {
					return boundFn;
				},
				set (value) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					fn = value;
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					delete this[key];
				},
			});

			return boundFn;
		},
		set (value) {
			fn = value;
		},
	};
}
