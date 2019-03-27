import Stream from "util/stream/Stream";

type Flat1<T> = T extends Iterable<infer X> ? X | Extract<T, string> | Exclude<T, Iterable<any>> : never;

declare global {

	interface IterableIterator<T> {

		/**
		 * Returns a value of type X, generated with the given collector function.
		 * @param collector A function that takes the iterable, and returns type X
		 *
		 * Note: Alias of `iterator.stream().collect()`
		 */
		collect<X> (collector: (val: IterableIterator<T>) => X): X;
		/**
		 * Returns a value of type X, generated with the given collector function.
		 * @param collector A function that takes the iterable, and returns type X
		 *
		 * Note: Alias of `iterator.stream().collect()`
		 */
		collect<X, A extends any[]> (collector: (val: IterableIterator<T>, ...args: A) => X, ...args: A): X;

		/**
		 * Returns an iterable that will loop only over the entries that match the given filter
		 * @param filter A function that returns a truthy value if the entry should be included and a falsey value if it shouldn't
		 *
		 * Note: The only difference between this method and `filter2` is the type argument: This method excludes the type argument,
		 * while the other returns it.
		 *
		 * Note: Alias of `iterator.stream().filter()`
		 */
		filter<X = never> (filter: (val: T) => any): Stream<Exclude<T, X>>;

		/**
		 * Returns an iterable that will loop only over the entries that match the given filter
		 * @param filter A function that returns a truthy value if the entry should be included and a falsey value if it shouldn't
		 *
		 * Note: The only difference between this method and `filter` is the type argument: This method returns the type argument,
		 * while the other excludes it.
		 *
		 * Note: Alias of `iterator.stream().filter2()`
		 */
		filter2<X = T> (filter: (val: T) => any): Stream<X>;

		/**
		 * Returns a new Stream iterating over each value of the current iterator, first run through the given mapper function.
		 *
		 * For example:
		 * ```ts
		 * [[1, 2, 3], [4, 5, 6]]
		 * 	.flatMap(numberArray => numberArray
		 * 		.map(num => num + 1))
		 * // result: [2, 3, 4, 5, 6, 7]
		 * ```
		 *
		 * Note: Alias of `iterator.stream().flatMap()`
		 */
		flatMap<X> (mapper: (value: T) => Iterable<X>): Stream<X>;
		/**
		 * Returns a new Stream iterating over every value of each value of this iterator. The values in this
		 * Stream must be iterable.
		 *
		 * Note: Alias of `iterator.stream().flatMap()`
		 */
		flatMap (): Stream<Flat1<T>>;
		/**
		 * Returns a new Stream iterating over every value of each value of this Stream. The values in this
		 * Stream must be iterable.
		 *
		 * Note: Alias of `iterator.stream().flatMap()`
		 */
		flatMap<X> (): Stream<X>;

		/**
		 * Loops the values of this iterable and calls the given function with each value.
		 */
		forEach (user: (val: T, index: number) => any): void;

		/**
		 * Returns an iterable of type X, using the given map function
		 * @param mapper A function that maps an entry of type T to its corresponding type X
		 *
		 * Note: Alias of `iterator.stream().map()`
		 */
		map<X> (mapper: (val: T) => X): Stream<X>;

		/**
		 * Returns a new Stream over this Iterator.
		 */
		stream (): Stream<T>;
	}
}

export default function () {

	/**
	 * One quirk with the `Iterator` support is that ones created from generator functions, `ArrayIterator`s,
	 * and `MapIterator`s are all different. We want this support to be available on each, so we make a list
	 * of everything that is an `IterableIterator` and then add all our methods to each in a loop.
	 */
	const prototypes = [
		Object.getPrototypeOf(function* (): any { }).prototype,
		Object.getPrototypeOf([][Symbol.iterator]()),
		Object.getPrototypeOf(new Map().keys()),
		Object.getPrototypeOf(new Set().values()),
	];

	const iteratorImpl: any = {

		map<T, X> (this: IterableIterator<T>, mapper: (val: T) => X): Stream<X> {
			return Stream.from(this).map(mapper);
		},

		filter (this: IterableIterator<any>, filterer: (val: any) => boolean) {
			return Stream.from(this).filter(filterer);
		},

		collect (this: Iterable<any>, collector: (val: any, ...args: any[]) => any, ...args: any[]) {
			return collector(this, ...args);
		},

		forEach (this: IterableIterator<any>, user: (val: any, index: number) => any) {
			let index = 0;
			for (const item of this) {
				user(item, index++);
			}
		},

		flatMap (this: Iterable<any>, mapper?: (value: any) => any) {
			return Stream.from(this).flatMap(mapper!);
		},

		stream (this: Iterable<any>) {
			return Stream.from(this);
		},
	};

	iteratorImpl.filter2 = iteratorImpl.filter;

	for (const prototype of prototypes) {
		for (const method in iteratorImpl) {
			prototype[method] = iteratorImpl[method as keyof typeof iteratorImpl];
		}
	}
}
