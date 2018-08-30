export default function Bound<T extends (...args: any[]) => any>
	(target: any, key: string, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T> | void {

	let fn = descriptor.value;

	return {
		configurable: true,
		get () {
			if (!this || this === target.prototype || this.hasOwnProperty(key) || typeof fn !== "function") {
				return fn!;
			}

			const boundFn = fn.bind(this) as T;
			Object.defineProperty(this, key, {
				configurable: true,
				get () {
					return boundFn;
				},
				set (value) {
					fn = value;
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
