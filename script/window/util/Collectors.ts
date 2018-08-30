module Collectors {
	export function toArray<T> (iterable: IterableIterator<T>) {
		return Array.from(iterable);
	}

	export function toString (join: string) {
		return (iterable: IterableIterator<any>) => {
			let result = "";

			for (const item of iterable) {
				result += `${item}${join}`;
			}

			return join.length === 0 ? result : result.slice(0, -join.length);
		};
	}

	/**
	 * Creates a collector function where all the values in the iterable are passed to the given function,
	 * and returns the result of that function.
	 * @param fn The function that takes any number of `T`.
	 * @param strategy `PassStrategy.Splat`
	 */
	export function passTo<T, X> (fn: (...args: T[]) => X, strategy: PassStrategy.Splat): (iterable: IterableIterator<T>) => X;
	/**
	 * Creates a collector function where a value in the iterable is passed to the given function,
	 * and returns the result of that function.
	 * @param fn The function that takes the type of `T`.
	 * @param strategy The strategy with which to choose which value in the iterable to return.
	 * Defaults to `PassStrategy.First`
	 */
	export function passTo<T, X> (fn: (arg: T) => X, strategy?: PassStrategy): (iterable: IterableIterator<T>) => X;
	export function passTo<T, X> (fn: (...arg: T[]) => X, strategy = PassStrategy.First) {
		return (iterable: IterableIterator<T>) => {
			if (strategy === PassStrategy.Splat) {
				return fn(...iterable);
			}

			const value = strategy === PassStrategy.First ? iterable.first() :
				strategy === PassStrategy.Last ? iterable.last() : iterable.random();
			return fn(value!);
		};
	}
}

export enum PassStrategy {
	First,
	Last,
	Random,
	Splat,
}

export default Collectors;
