// tslint:disable interface-name max-file-line-count

import Arrays, { tuple } from "util/Arrays";
import { isIterable } from "util/Iterables";
import { generalRandom, Random } from "util/Random";
import FlatMapStream from "util/stream/FlatMapStream";
import { Streamable } from "util/stream/IStream";
import Partitions from "util/stream/Partitions";
import RangeStream from "util/stream/RangeStream";

type Action<T> =
	["filter", (val: T) => boolean] |
	["map", (val: T) => any] |
	["take", number] |
	["takeWhile", (val: T) => boolean] |
	["drop", number] |
	["dropWhile", (val: T) => boolean] |
	["step", number, number];

type Flat1<T> = T extends Iterable<infer X> ? X | Extract<T, string> | Exclude<T, Iterable<any>> : never;

export interface UnzippedPartitions<K, V> {
	get (partition: "key"): Stream<K>;
	get (partition: "value"): Stream<V>;
	partitions (): Stream<["key", Stream<K>] | ["value", Stream<V>]>;
}

export interface IPartitions<K, V> extends Streamable<[K, Stream<V>]> {

	/**
	 * Returns a single partitioned Stream by the given key.
	 * @param key The key of the partitioned Stream.
	 *
	 * Note: The partition Streams returned from this method are the same as returned by `partitions()`. Iterating through
	 * a stream in either location will also empty it in the other.
	 */
	get (key: K): Stream<V>;

	/**
	 * Returns a Stream of tuples for all the partitioned Streams.
	 *
	 * Note: The partition Streams returned from this method are the same as returned by `partitions()`. Iterating through
	 * a stream in either location will also empty it in the other.
	 */
	partitions (): Stream<[K, Stream<V>]>;
}

/**
 * Note: When "splatting" a stream, it's actually faster (but not by much) to first collect it into an array:
 * ```ts
 * // slower
 * [...Stream.range(10)]
 *
 * // faster
 * [...Stream.range(10).toArray()]
 * ```
 */
export default abstract class Stream<T> implements Streamable<T>, Iterable<T> {

	public static get empty () {
		return Stream.of<any>();
	}

	public static from<T> (iterable: Iterable<T> | Streamable<T>): Stream<T> {
		return iterable instanceof StreamImplementation ? iterable :
			isIterable(iterable) ? new StreamImplementation((iterable)[Symbol.iterator]()) :
				new StreamImplementation(iterable);
	}

	public static of<A extends any[]> (...args: A): Stream<A[number]> {
		return Stream.from(args);
	}

	public static range (end: number): Stream<number>;
	public static range (start: number, end?: number, step?: number): Stream<number>;
	public static range (start: number, end?: number, step = 1): Stream<number> {
		if (end === undefined) {
			end = start;
			start = 0;
		}

		return Stream.from(new RangeStream(start, end, step));
	}

	/**
	 * Returns a Stream that iterates over the entries of a map, in key-value tuples.
	 */
	public static entries<K, V> (map?: Map<K, V>): Stream<[K, V]>;
	/**
	 * Returns a Stream that iterates over the entries of an object, in key-value tuples.
	 */
	public static entries<T extends object> (obj?: T): Stream<[Extract<keyof T, string>, T[Extract<keyof T, string>]]>;
	/**
	 * Returns a Stream that iterates over the entries of an object, in key-value tuples.
	 */
	public static entries<K, V> (obj?: any): Stream<[K, V]>;
	public static entries<T extends object> (obj?: T): Stream<[any, any]> {
		if (obj === undefined) {
			return Stream.of() as any;
		}

		if (obj instanceof Map) {
			return new StreamImplementation(obj.entries()) as any;
		}

		// todo: the following call can probably be made more efficient by looping the entries of the object manually
		// rather than calling `Object.entries` and making a Stream from that result array
		return Stream.from(Object.entries(obj));
	}

	/**
	 * Returns a Stream that iterates over the keys of a map.
	 */
	public static keys<K> (map: Map<K, any>): Stream<K>;
	/**
	 * Returns a Stream that iterates over the keys of an object.
	 */
	public static keys<T extends object> (obj: T): Stream<keyof T>;
	/**
	 * Returns a Stream that iterates over the keys of an object.
	 */
	public static keys<K extends string | number> (obj: { [key in K]: any }): Stream<K>;
	public static keys (obj: any): Stream<any> {
		if (obj instanceof Map) {
			return new StreamImplementation(obj.keys());
		}

		// todo: the following call can probably be made more efficient by looping the keys of the object manually
		// rather than calling `Object.keys` and making a Stream from that result array
		return Stream.from(Object.keys(obj));
	}

	/**
	 * Returns a Stream that iterates over the values of a map.
	 */
	public static values<V> (map: Map<any, V>): Stream<V>;
	/**
	 * Returns a Stream that iterates over the values of an object.
	 */
	public static values<T extends object> (obj: T): Stream<keyof T>;
	public static values (obj: any): Stream<any> {
		if (obj instanceof Map) {
			return new StreamImplementation(obj.values());
		}

		// todo: the following call can probably be made more efficient by looping the values of the object manually
		// rather than calling `Object.values` and making a Stream from that result array
		return Stream.from(Object.values(obj));
	}

	/**
	 * Takes two iterables representing "keys" and "values", and turns them into a Stream of 2-value tuples. The resulting
	 * Stream will end when either of the iterables runs out of items. (Its size will be that of the smaller of the two
	 * input iterables/streams).
	 */
	public static zip<K, V> (keysIterable: Iterable<K> | Stream<K>, valuesIterable: Iterable<V> | Stream<V>): Stream<[K, V]> {
		const values = valuesIterable instanceof Stream ? new StreamImplementation(valuesIterable) : Stream.from(valuesIterable);
		return (keysIterable instanceof Stream ? new StreamImplementation(keysIterable) : Stream.from(keysIterable))
			.takeWhile(() => {
				values.next();
				return !values.done;
			})
			.map((key: any) => tuple(key, values.value));
	}

	public done: boolean;
	public value: T;
	public abstract [Symbol.iterator] (): Iterator<T>;
	public abstract [Symbol.asyncIterator] (): AsyncIterableIterator<T extends Promise<infer R> ? R : never>;

	////////////////////////////////////
	// Manipulation
	//

	/**
	 * Returns a Stream that will loop only over the entries that match the given filter
	 * @param filter A function that returns a truthy value if the entry should be included and a falsey value if it shouldn't
	 *
	 * Note: The only difference between this method and `filter2` is the type argument: This method excludes the type argument,
	 * while the other returns it.
	 */
	public abstract filter<X = never> (filter: (val: T) => any): Stream<Exclude<T, X>>;

	/**
	 * Returns a Stream that will loop only over the entries that match the given filter
	 * @param filter A function that returns a truthy value if the entry should be included and a falsey value if it shouldn't
	 *
	 * Note: The only difference between this method and `filter` is the type argument: This method returns the type argument,
	 * while the other excludes it.
	 */
	public abstract filter2<X = T> (filter: (val: T) => any): Stream<X>;

	/**
	 * Returns a Stream of type X, using the given mapper function
	 * @param mapper A function that maps an entry of type T to its corresponding type X
	 */
	public abstract map<X> (mapper: (val: T) => X): Stream<X>;

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
	 */
	public abstract flatMap<X> (mapper: (value: T) => Iterable<X>): Stream<X>;
	/**
	 * Returns a new Stream iterating over every value of each value of this iterator. The values in this
	 * Stream must be iterable.
	 */
	public abstract flatMap (): Stream<Flat1<T>>;
	/**
	 * Returns a new Stream iterating over every value of each value of this Stream. The values in this
	 * Stream must be iterable.
	 */
	public abstract flatMap<X> (): Stream<X>;

	/**
	 * Returns a Stream which will only go through the first X items, where X is the given argument.
	 */
	public abstract take (amount: number): Stream<T>;

	/**
	 * Returns a Stream which will only iterate through the items in this Stream until the predicate doesn't match.
	 * @param predicate A predicate function that takes a Stream value and its index.
	 */
	public abstract takeWhile (predicate: (val: T) => boolean): Stream<T>;

	/**
	 * Returns a Stream which will skip the first X items, where X is the given argument.
	 */
	public abstract drop (amount: number): Stream<T>;

	/**
	 * Returns a Stream which will skip the items in this Stream until the predicate doesn't match.
	 * @param predicate A predicate function that takes a Stream value and its index.
	 */
	public abstract dropWhile (predicate: (val: T) => boolean): Stream<T>;

	/**
	 * Returns a Stream which steps through the items in the current Stream using the provided step amount.
	 * @param step A non-zero integer. Positive integers will step forwards through the Stream, negative integers
	 * will step backwards.
	 *
	 * Note: Stepping backwards will require iteration through this entire Stream.
	 */
	public abstract step (step: number): Stream<T>;

	/**
	 * Returns a new Stream which contains the sorted contents of this stream. The values are sorted in ascending ASCII order.
	 */
	public abstract sorted (): Stream<T>;
	/**
	 * Returns a new Stream which contains the sorted contents of this Stream.
	 * @param comparator A function that returns a "difference" between `a` and `b`, for sorting by.
	 */
	public abstract sorted (comparator: (a: T, b: T) => number): Stream<T>;

	/**
	 * Returns a new Stream which contains the contents of this Stream, in reverse order.
	 */
	public abstract reverse (): Stream<T>;

	/**
	 * Returns a new Stream which contains only unique items in this Stream.
	 *
	 * Note: Alias of `stream.toSet().stream()`
	 */
	public abstract distinct (): Stream<T>;

	/**
	 * Returns a new Stream of the shuffled items in this Stream.
	 *
	 * Note: This method is an alias of `stream.toArray().shuffle(random).stream()`
	 */
	public abstract shuffle (random?: Random): Stream<T>;

	/**
	 * Returns a `Partitions` instance which allows sorting items of this Stream into separate sub-streams, or "partitions".
	 * @param sorter A function which takes an item in this Stream and maps it to the "key" of its partition.
	 *
	 * Example:
	 * ```ts
	 * Stream.of("dog", "horse", "cat", "pig", "goat", "chicken", "cow")
	 * 	.partition(animal => animal.length) // splits the animal list into partitions by the length of their names
	 * 	.get(3) // gets the partition of animals with 3 letter long names
	 * 	.toArray(); // ["dog", "cat", "pig", "cow"]
	 * ```
	 */
	public abstract partition<K> (sorter: (val: T) => K): Partitions<K, T>;

	/**
	 * Returns a `Partitions` instance where the T items (should be 2-value Tuples) of this Stream are split into two
	 * partition Streams: "key" and "value".
	 */
	public abstract unzip (): T extends [infer K, infer V] ? UnzippedPartitions<K, V> : never;

	/**
	 * Returns a new Stream containing the items in this Stream and then the items provided.
	 */
	public abstract add<N> (...items: N[]): Stream<T | N>;

	/**
	 * Returns a new Stream containing the items in this Stream and then the items in all provided Streams or Iterables.
	 */
	public abstract merge<N> (...iterables: Array<Stream<N> | Iterable<N>>): Stream<T | N>;

	/**
	 * Returns a new Stream of the same type, after first collecting this Stream into an array.
	 *
	 * Why is this useful? It can be used, for example, to prevent concurrent modification errors. Since it collects
	 * everything into an array before streaming the values, it allows doing things such as deletion from the source object.
	 *
	 * Note: This method is an alias of `stream.toArray().stream()`.
	 */
	public abstract collectStream (): Stream<T>;

	/**
	 * Returns a new Stream of the values in this stream, and their index.
	 */
	public abstract entries (): Stream<[number, T]>;

	////////////////////////////////////
	// Collection
	//

	/**
	 * Returns the item at the given index, or `undefined` if it does not exist.
	 *
	 * Note: An alias for `drop(index - 1).first()`.
	 */
	public abstract at (index: number): T | undefined;
	/**
	 * Returns the item at the given index, or `orElse` if it does not exist.
	 *
	 * Note: An alias for `drop(index - 1).first(orElse)`.
	 */
	public abstract at (index: number, orElse: T): T;
	/**
	 * Returns the item at the given index, or, if it does not exist, `orElse`, or `undefined` if `orElse` is not provided.
	 *
	 * Note: An alias for `drop(index - 1).first(orElse)`.
	 */
	public abstract at (index: number, orElse?: T): T | undefined;

	/**
	 * Returns true if the predicate returns true for any of the items in this Stream
	 * @param predicate A predicate function that takes a Stream value and its index.
	 */
	public abstract any (predicate: (val: T, index: number) => boolean): boolean;

	/**
	 * Returns true if the predicate returns true for any of the items in this Stream
	 * @param predicate A predicate function that takes a Stream value and its index.
	 *
	 * Note: Alias of `any()`
	 */
	public abstract some (predicate: (val: T, index: number) => boolean): boolean;

	/**
	 * Returns true if the predicate returns true for every item in the Stream
	 * @param predicate A predicate function that takes a Stream value and its index.
	 */
	public abstract every (predicate: (val: T, index: number) => boolean): boolean;

	/**
	 * Returns true if the predicate returns true for every item in the Stream
	 * @param predicate A predicate function that takes a Stream value and its index.
	 *
	 * Note: Alias of `every()`
	 */
	public abstract all (predicate: (val: T, index: number) => boolean): boolean;

	/**
	 * Returns true if the predicate returns false for every item in the Stream
	 * @param predicate A predicate function that takes a Stream value and its index.
	 */
	public abstract none (predicate: (val: T, index: number) => boolean): boolean;

	/**
	 * Returns whether the Stream includes any of the the given values. Uses strict equality comparison. `===`
	 */
	public abstract includes (...values: T[]): boolean;

	/**
	 * Returns whether the Stream includes any of the the given values. Uses strict equality comparison. `===`
	 *
	 * Note: Alias of `includes()`
	 */
	public abstract contains (...values: T[]): boolean;

	/**
	 * Returns whether the Stream includes any of the the given values. Uses strict equality comparison. `===`
	 *
	 * Note: Alias of `includes()`
	 */
	public abstract has (...values: T[]): boolean;

	/**
	 * Returns whether the Stream includes all of the the given values. Uses strict equality comparison. `===`
	 */
	public abstract includesAll (...values: T[]): boolean;

	/**
	 * Returns whether the Stream includes all of the the given values. Uses strict equality comparison. `===`
	 *
	 * Note: Alias of `includesAll()`
	 */
	public abstract containsAll (...values: T[]): boolean;

	/**
	 * Returns whether the Stream includes all of the the given values. Uses strict equality comparison. `===`
	 *
	 * Note: Alias of `includesAll()`
	 */
	public abstract hasAll (...values: T[]): boolean;

	/**
	 * Returns whether this Stream has any items in common with items in the given iterables.
	 */
	public abstract intersects (...iterables: Array<Iterable<T>>): boolean;

	/**
	 * Returns the number of items in this Stream.
	 */
	public abstract count (): number;

	/**
	 * Returns the number of items in this Stream.
	 *
	 * Note: Alias of `count`
	 */
	public abstract length (): number;

	/**
	 * Returns the number of items in this Stream.
	 *
	 * Note: Alias of `count`
	 */
	public abstract size (): number;

	/**
	 * Returns a new value by combining the items in this Stream using the given reducer function.
	 * @param reducer A function which takes the current value and the next value and returns a new value.
	 */
	public abstract fold<R> (initial: R, folder: (current: R, newValue: T, index: number) => R): R;

	/**
	 * **This method does not work like array reduce. If that's what you're looking for, see `fold`**
	 *
	 * Returns a single `T` by combining the items in this Stream using the given reducer function. Returns `undefined`
	 * if there are no items in this Stream.
	 * @param reducer A function which takes the current value and the next value and returns a new value of the same type.
	 */
	public abstract reduce (reducer: (current: T, newValue: T, index: number) => T): T | undefined;

	/**
	 * Returns the first item in this Stream, or `undefined` if there are no items.
	 */
	public abstract first (): T | undefined;
	/**
	 * Returns the first item in this Stream that matches a predicate, or `orElse` if there are none.
	 * @param predicate A predicate function that takes a Stream value and its index.
	 */
	public abstract first (predicate: undefined | ((val: T, index: number) => boolean), orElse: T): T;
	/**
	 * Returns the first item in this Stream that matches a predicate, or `orElse` if there are none.
	 * @param predicate A predicate function that takes a Stream value and its index.
	 */
	public abstract first (predicate?: (val: T, index: number) => boolean, orElse?: T): T | undefined;

	/**
	 * Returns the first item in this Stream, or `undefined` if there are no items.
	 *
	 * Note: Alias of `first()`
	 */
	public abstract find (): T | undefined;
	/**
	 * Returns the first item in this Stream that matches a predicate, or `orElse` if there are none.
	 * @param predicate A predicate function that takes a Stream value and its index.
	 *
	 * Note: Alias of `first()`
	 */
	public abstract find (predicate: undefined | ((val: T, index: number) => boolean), orElse: T): T;
	/**
	 * Returns the first item in this Stream that matches a predicate, or `orElse` if there are none.
	 * @param predicate A predicate function that takes a Stream value and its index.
	 *
	 * Note: Alias of `first()`
	 */
	public abstract find (predicate?: (val: T, index: number) => boolean, orElse?: T): T | undefined;

	/**
	 * Returns the last item in this Stream, or `undefined` if there are no items.
	 */
	public abstract last (): T | undefined;
	/**
	 * Returns the last item in this Stream that matches a predicate, or `orElse` if there are none.
	 * @param predicate A predicate function that takes a Stream value and its index.
	 */
	public abstract last (predicate: undefined | ((val: T, index: number) => boolean), orElse: T): T;
	/**
	 * Returns the last item in this Stream that matches a predicate, or `orElse` if there are none.
	 * @param predicate A predicate function that takes a Stream value and its index.
	 */
	public abstract last (predicate?: (val: T, index: number) => boolean, orElse?: T): T | undefined;

	/**
	 * Returns a random item in this Stream, or `undefined` if there are none.
	 */
	public abstract random (): T | undefined;
	/**
	 * Returns a random item in this Stream, or `orElse` if there are none.
	 */
	public abstract random (orElse: T, random?: Random): T;
	/**
	 * Returns a random item in this Stream, or `orElse` if there are none.
	 */
	public abstract random (orElse?: T): T | undefined;
	/**
	 * Returns a random item in this Stream, or `orElse` if there are none.
	 */
	public abstract random (orElse?: T, random?: Random): T | undefined;

	/**
	 * Returns a value of type R, generated with the given collector function.
	 * @param collector A function that takes the iterable, and returns type R
	 */
	public abstract collect<R> (collector: (stream: Stream<T>) => R): R;
	/**
	 * Returns a value of type R, generated with the given collector function.
	 * @param collector A function that takes the iterable, and returns type R
	 */
	public abstract collect<R, A extends any[]> (collector: (stream: Stream<T>, ...args: A) => R, ...args: A): R;

	/**
	 * Returns a value of type R, generated with the given collector function.
	 * @param collector A function that takes the splatted values in this iterable, and returns type R
	 */
	public abstract splat<R> (collector: (...args: T[]) => R): R;

	/**
	 * Returns a promise that will return the value of the first completed promise in this stream.
	 *
	 * Note: Alias of `Promise.race(stream.toArray())`
	 */
	public abstract race (): Promise<T extends Promise<infer R> ? R : never>;

	/**
	 * Returns a promise of a stream with all items await-ed.
	 *
	 * Note: Alias of `Promise.all(stream.toArray()).stream()`
	 */
	public abstract rest (): Promise<T extends Promise<infer R> ? Stream<R> : never>;

	/**
	 * Collects the items in this Stream to an array.
	 */
	public abstract toArray (): T[];
	/**
	 * Appends the items in this Stream to the end of the given array.
	 */
	public abstract toArray<N> (array: N[]): Array<T | N>;

	/**
	 * Collects the items in this Stream to a Set.
	 */
	public abstract toSet (): Set<T>;
	/**
	 * Appends the items in this Stream to the end of the given Set.
	 */
	public abstract toSet<N> (set: Set<N>): Set<T | N>;

	/**
	 * Constructs a Map instance from the key-value pairs in this Stream.
	 */
	public abstract toMap (): T extends [infer K, infer V] ? Map<K, V> : never;
	/**
	 * Puts the key-value pairs in this Stream into the given Map.
	 */
	public abstract toMap<KN, VN> (map: Map<KN, VN>): T extends [infer K, infer V] ? Map<K | KN, V | VN> : never;
	/**
	 * Constructs a Map instance from the items in this Stream, using a mapping function.
	 * @param mapper A mapping function which takes an item in this Stream and returns a key-value pair.
	 */
	public abstract toMap<K, V> (mapper: (value: T, index: number) => [K, V]): Map<K, V>;
	/**
	 * Puts the key-value pairs in this Stream into the given Map, using a mapping function.
	 * @param map The map to put key-value pairs into.
	 * @param mapper A mapping function which takes an item in this Stream and returns a key-value pair.
	 */
	public abstract toMap<K, V, KN, VN> (map: Map<KN, VN>, mapper: (value: T, index: number) => [K, V]): Map<K, V>;

	/**
	 * Constructs an object from the key-value pairs in this Stream.
	 */
	public abstract toObject (): T extends [infer K, infer V] ? { [key in Extract<K, string | number | symbol>]: V } : never;
	/**
	 * Puts the key-value pairs in this Stream into the given object.
	 */
	public abstract toObject<O> (obj: O): T extends [infer K, infer V] ? O & { [key in Extract<K, string | number | symbol>]: V } : never;
	/**
	 * Constructs an object from the items in this Stream, using a mapping function.
	 * @param mapper A mapping function which takes an item in this Stream and returns a key-value pair.
	 */
	public abstract toObject<K extends string | number | symbol, V> (mapper: (value: T, index: number) => [K, V]): { [key in K]: V };
	/**
	 * Puts the key-value pairs in this Stream into the given object, using a mapping function.
	 * @param map The map to put key-value pairs into.
	 * @param mapper A mapping function which takes an item in this Stream and returns a key-value pair.
	 */
	public abstract toObject<K extends string | number | symbol, V, O> (obj: O, mapper: (value: T, index: number) => [K, V]): O & { [key in K]: V };

	/**
	 * Combines the items in this Stream into a string.
	 * @param concatenator A substring to be placed between every item in this Stream. If not provided, uses `""`
	 */
	public abstract toString (concatenator?: string): string;
	/**
	 * Combines the items in this Stream into a string, via a reducer function.
	 * @param concatenator Takes the current string and the next value and returns the new string.
	 */
	public abstract toString (concatenator: (current: string, value: T) => string): string;

	/**
	 * Iterates through the entire stream.
	 */
	public abstract iterateToEnd (): void;
	/**
	 * Iterates through the entire stream.
	 *
	 * Note: Alias of `iterateToEnd()`
	 */
	public abstract finish (): void;
	/**
	 * Iterates through the entire stream.
	 *
	 * Note: Alias of `iterateToEnd()`
	 */
	public abstract end (): void;
	/**
	 * Iterates through the entire stream.
	 *
	 * Note: Alias of `iterateToEnd()`
	 */
	public abstract complete (): void;
	/**
	 * Iterates through the entire stream.
	 *
	 * Note: Alias of `iterateToEnd()`
	 */
	public abstract flush (): void;

	////////////////////////////////////
	// Misc
	//

	/**
	 * Runs a function on each item in this Stream.
	 * @param user The function to call for each item
	 */
	public abstract forEach (user: (val: T, index: number) => any): void;

	public abstract next (): void;

	/**
	 * Returns whether the Stream has a next entry.
	 */
	public abstract hasNext (): boolean;
}

class StreamImplementation<T> extends Stream<T> {

	private readonly iterators: Array<Iterator<T> | Streamable<T>>;
	private iteratorIndex = 0;
	private readonly actions: Array<Action<T>> = [];
	private _value: T;
	private _done = false;
	private doneNext = false;
	private readonly savedNext: T[] = [];

	public get value () { return this._value; }
	public get done () { return this._done; }

	public constructor (...iterators: Array<Iterator<T> | Streamable<T>>) {
		super();
		this.iterators = iterators;
	}

	public [Symbol.iterator] () {
		return {
			next: () => {
				this.next();
				return {
					done: this._done,
					value: this._value,
				};
			},
		};
	}

	public [Symbol.asyncIterator] () {
		return {
			next: async () => {
				this.next();
				return {
					done: this._done,
					value: await this._value as any,
				};
			},
		} as any;
	}

	////////////////////////////////////
	// Manipulation
	//

	public filter (filter: (val: T) => any) {
		if (this.savedNext.length) {
			if (!filter(this.savedNext[0])) {
				this.savedNext.pop();
			}
		}

		this.actions.push(["filter", filter]);

		return this as any;
	}

	public filter2 (filter: (val: T) => any) {
		return this.filter(filter);
	}

	public map (mapper: (val: T) => any) {
		this.actions.push(["map", mapper]);
		if (this.savedNext.length) {
			this.savedNext[0] = mapper(this.savedNext[0]);
		}

		return this as any;
	}

	public flatMap (mapper?: (value: T) => Iterable<any>) {
		return new StreamImplementation(new FlatMapStream(this, mapper)) as any;
	}

	public take (amount: number) {
		if (amount === 0) {
			this._done = true;

		} else {
			if (this.savedNext.length) {
				amount--;
			}

			this.actions.push(["take", amount]);
		}

		return this;
	}

	public takeWhile (predicate: (val: T) => boolean) {
		if (this.savedNext.length) {
			if (!predicate(this.savedNext[0])) {
				this._done = true;
			}
		}

		this.actions.push(["takeWhile", predicate]);

		return this;
	}

	public drop (amount: number) {
		if (amount > 0) {
			if (this.savedNext.length) {
				amount--;
				this.savedNext.pop();
			}

			this.actions.push(["drop", amount]);
		}

		return this;
	}

	public dropWhile (predicate: (val: T) => boolean) {
		if (this.savedNext.length) {
			if (predicate(this.savedNext[0])) {
				this.savedNext.pop();

			} else {
				return this;
			}
		}

		this.actions.push(["dropWhile", predicate]);

		return this;
	}

	public step (step: number) {
		if (step === 1) {
			return this;
		}

		if (step <= 0) {
			return this.toArray().stream(step);
		}

		let current = step;
		if (this.savedNext.length) {
			this.savedNext.pop();
			current--;
		}

		this.actions.push(["step", current, step]);

		return this;
	}

	public sorted (comparator?: (a: T, b: T) => number) {
		return Stream.from(this.toArray().sort(comparator));
	}

	public reverse () {
		return Stream.from(this.toArray().reverse());
	}

	public distinct () {
		return Stream.from(this.toSet());
	}

	public shuffle () {
		return new StreamImplementation(Arrays.shuffle(this.toArray())[Symbol.iterator]());
	}

	public partition<K> (sorter: (val: T) => K): Partitions<any, any> {
		return new Partitions(this, sorter, partitionStream => new StreamImplementation(partitionStream));
	}

	public unzip (): any {
		return new Partitions(this.flatMap(), (value, index) => index % 2 ? "value" : "key", partitionStream => new StreamImplementation(partitionStream));
	}

	public add (...items: any[]) {
		return new StreamImplementation<any>(this, items[Symbol.iterator]());
	}

	public merge (...iterables: Array<Iterable<any>>) {
		return new StreamImplementation(this, ...iterables
			.map(iterable => iterable instanceof StreamImplementation ? iterable : iterable[Symbol.iterator]()));
	}

	public collectStream () {
		return new StreamImplementation(this.toArray()[Symbol.iterator]());
	}

	public entries () {
		let i = 0;
		return this.map(value => tuple(i++, value));
	}

	////////////////////////////////////
	// Collection
	//

	public at (index: number): T | undefined;
	public at (index: number, orElse: T): T;
	public at (index: number, orElse?: T): T | undefined;
	public at (index: number, orElse?: T) {
		this.drop(index);
		return this.first(undefined, orElse);
	}

	public any (predicate: (val: T, index: number) => boolean) {
		let index = 0;
		while (true) {
			this.next();
			if (this._done) {
				return false;
			}

			if (predicate(this._value, index++)) {
				return true;
			}
		}
	}

	public some (predicate: (val: T, index: number) => boolean) {
		return this.any(predicate);
	}

	public every (predicate: (val: T, index: number) => boolean) {
		let index = 0;
		while (true) {
			this.next();
			if (this._done) {
				return true;
			}

			if (!predicate(this._value, index++)) {
				return false;
			}
		}
	}

	public all (predicate: (val: T, index: number) => boolean) {
		return this.every(predicate);
	}

	public none (predicate: (val: T, index: number) => boolean) {
		let index = 0;
		while (true) {
			this.next();
			if (this._done) {
				return true;
			}

			if (predicate(this._value, index++)) {
				return false;
			}
		}
	}

	public includes (...values: T[]) {
		while (true) {
			this.next();
			if (this._done) {
				return false;
			}

			if (values.includes(this._value)) {
				return true;
			}
		}
	}

	public contains (...values: T[]) {
		return this.includes(...values);
	}

	public has (...values: T[]) {
		return this.includes(...values);
	}

	public includesAll (...values: T[]) {
		while (true) {
			this.next();
			if (this._done) {
				return false;
			}

			const i = values.indexOf(this._value);
			if (i > -1) {
				values.splice(i, 1);
				if (values.length === 0) {
					return true;
				}
			}
		}
	}

	public containsAll (...values: T[]) {
		return this.includesAll(...values);
	}

	public hasAll (...values: T[]) {
		return this.includesAll(...values);
	}

	// tslint:disable-next-line cyclomatic-complexity
	public intersects (...iterables: Array<Iterable<T>>) {
		while (true) {
			this.next();
			if (this._done) {
				return false;
			}

			for (let i = 0; i < iterables.length; i++) {
				let iterable = iterables[i];
				// the first time we check each iterable to see if it contains the current value, we
				// turn it into an array (or leave sets) so we can take advantage of the (probably)
				// faster native `includes`/`has` checking.
				// however, we only loop through the iterable as much as is required -- if we happen
				// to run into the current value, we return true then
				if (!Array.isArray(iterable) && !(iterable instanceof Set)) {
					const replacementArray = [];
					for (const item of iterable) {
						if (item === this._value) {
							return true;
						}

						replacementArray.push(item);
					}

					iterable = iterables[i] = replacementArray;
				}

				if (Array.isArray(iterable)) {
					if (iterable.includes(this._value)) {
						return true;
					}

				} else if (iterable instanceof Set) {
					if (iterable.has(this._value)) {
						return true;
					}
				}
			}
		}
	}

	public count () {
		let i = 0;
		while (true) {
			this.next();
			if (this._done) {
				return i;
			}

			i++;
		}
	}

	public length () {
		return this.count();
	}

	public size () {
		return this.count();
	}

	public fold<R> (initial: R, folder: (current: R, newValue: T, index: number) => R) {
		let index = 0;
		let value = initial;
		while (true) {
			this.next();
			if (this._done) {
				return value;
			}

			value = folder(value, this._value, index++);
		}
	}

	public reduce (reducer: (current: T, newValue: T, index: number) => T) {
		this.next();
		let index = 1;
		let value = this._value;
		while (true) {
			this.next();
			if (this._done) {
				return value;
			}

			value = reducer(value, this._value, index++);
		}
	}

	public first (): T | undefined;
	public first (predicate?: (val: T, index: number) => boolean, orElse?: T): T | undefined;
	public first (predicate: undefined | ((val: T, index: number) => boolean), orElse: T): T;
	public first (predicate?: (val: T, index: number) => boolean, orElse?: T) {
		let index = 0;
		while (true) {
			this.next();
			if (this._done) {
				return orElse;
			}

			if (!predicate || predicate(this._value, index++)) {
				return this._value;
			}
		}
	}

	public find (): T | undefined;
	public find (predicate?: (val: T, index: number) => boolean, orElse?: T): T | undefined;
	public find (predicate: undefined | ((val: T, index: number) => boolean), orElse: T): T;
	public find (predicate?: (val: T, index: number) => boolean, orElse?: T) {
		return this.first(predicate, orElse);
	}

	public last (): T | undefined;
	public last (predicate?: (val: T, index: number) => boolean, orElse?: T): T | undefined;
	public last (predicate: undefined | ((val: T, index: number) => boolean), orElse: T): T;
	public last (predicate?: (val: T, index: number) => boolean, orElse?: T) {
		let index = 0;
		let last = orElse;
		while (true) {
			this.next();
			if (this._done) {
				break;
			}

			if (!predicate || predicate(this._value, index++)) {
				last = this._value;
			}
		}

		return last;
	}

	public random (orElse?: T, random = generalRandom) {
		if (!this.hasNext()) {
			return orElse;
		}

		return random.choice(...this);
	}

	public collect<R> (collector: (stream: Stream<T>) => R): R {
		return collector(this);
	}

	public splat<R> (collector: (...values: T[]) => R): R {
		return collector(...this.toArray());
	}

	public async race (): Promise<any> {
		return Promise.race(this.toArray()) as any;
	}

	public async rest (): Promise<any> {
		return (await Promise.all(this.toArray())).stream() as any;
	}

	public toArray (): T[];
	public toArray<N> (array: N[]): Array<T | N>;
	public toArray (result: any[] = []) {
		while (true) {
			this.next();
			if (this._done) {
				return result;
			}

			result.push(this._value);
		}
	}

	public toSet (): Set<T>;
	public toSet<N> (set: Set<N>): Set<T | N>;
	public toSet (result: Set<any> = new Set()) {
		while (true) {
			this.next();
			if (this._done) {
				return result;
			}

			result.add(this._value);
		}
	}

	public toMap (result?: Map<any, any> | ((value: any, index: number) => [any, any]), mapper?: (value: any, index: number) => [any, any]): any {
		if (typeof result === "function") {
			mapper = result;
			result = new Map();

		} else if (result === undefined) {
			result = new Map();
		}

		let index = 0;
		while (true) {
			this.next();
			if (this._done) {
				return result;
			}

			if (mapper) {
				result.set(...mapper(this._value, index++));

			} else {
				if (!Array.isArray(this._value)) {
					console.warn("[Stream]", "Can't convert the stream value", this._value, "into a key-value pair.");
					continue;
				}

				result.set(...this._value as any as [any, any]);
			}
		}
	}

	public toObject (result?: any | ((value: any, index: number) => [any, any]), mapper?: (value: any, index: number) => [any, any]) {
		if (typeof result === "function") {
			mapper = result;
			result = {};

		} else if (result === undefined) {
			result = {};
		}

		let index = 0;
		while (true) {
			this.next();
			if (this._done) {
				return result;
			}

			if (mapper) {
				const [key, value] = mapper(this._value, index++);
				result[`${key}`] = value;

			} else {
				if (!Array.isArray(this._value)) {
					console.warn("[Stream]", "Can't convert the stream value", this._value, "into a key-value pair.");
					continue;
				}

				const [key, value] = this._value as any as [any, any];
				result[`${key}`] = value;
			}
		}
	}

	public toString (concatenator?: string): string;
	public toString (concatenator: (current: string, value: T) => string): string;
	public toString (concatenator: string | ((current: string, value: T) => string) = "") {
		let result = "";
		while (true) {
			this.next();
			if (this._done) {
				return result;
			}

			if (typeof concatenator === "string") {
				result += `${concatenator}${this._value}`;

			} else {
				result = concatenator(result, this._value);
			}
		}
	}

	public iterateToEnd () {
		while (true) {
			this.next();
			if (this._done) {
				return;
			}
		}
	}
	public finish () { this.iterateToEnd(); }
	public end () { this.iterateToEnd(); }
	public complete () { this.iterateToEnd(); }
	public flush () { this.iterateToEnd(); }

	////////////////////////////////////
	// Misc
	//

	public forEach (user: (val: T, index: number) => any) {
		let index = 0;
		while (true) {
			this.next();
			if (this._done) {
				return;
			}

			user(this._value, index++);
		}
	}

	// tslint:disable-next-line cyclomatic-complexity
	public next () {
		if (this.doneNext || this._done) {
			this._done = true;
			return;
		}

		if (this.savedNext.length) {
			this._value = this.savedNext.pop()!;
			return;
		}

		FindNext:
		while (true) {
			const { done, value } = this.iterators[this.iteratorIndex].next() || (this.iterators[this.iteratorIndex] as Streamable<T>);
			this._value = value;
			if (done) {
				this.iteratorIndex++;
				if (this.iteratorIndex >= this.iterators.length) {
					this._done = true;
					return;
				}

				continue;
			}

			for (const action of this.actions) {
				switch (action[0]) {
					case "filter": {
						const filter = action[1];
						if (!filter(this._value)) {
							continue FindNext;
						}

						break;
					}
					case "map": {
						const mapper = action[1];
						this._value = mapper(this._value);
						break;
					}
					case "take": {
						// this "take" implementation is simple and fun, the way it works is it stores the number
						// left to take in the action itself, so that every time it hits the "take" action, it checks
						// if enough have been taken already. If not, it continues as per normal. Otherwise, it marks
						// this stream as finishing on the next "next" call. (Before processing it.)
						const amount = action[1];
						if (amount === 1) {
							this.doneNext = true;
							return;
						}

						action[1] = amount - 1;
						break;
					}
					case "drop": {
						const amount = action[1]--;
						if (amount > 0) {
							// todo: remove this action at 1 for efficiency
							continue FindNext;
						}

						break;
					}
					case "takeWhile": {
						const predicate = action[1];
						if (!predicate(this._value)) {
							this._done = true;
							return;
						}

						break;
					}
					case "dropWhile": {
						const predicate = action[1];
						if (predicate(this._value)) {
							continue FindNext;
						}

						// todo: remove this action for efficiency

						break;
					}
					case "step": {
						// this is a fun one too, so i'll explain how it works:
						// 1. we store the "step size" and the "current step" in the action.
						// - action[1] is the current,
						// - action[2] is the size
						// 2. when the action is performed, we subtract one from the current step
						// 3. if the step is 0:
						// - that means this current value is the new value
						// - we reset the current step to the step size and allow it to continue again next time

						// action[1] is the current step
						action[1]--;
						if (action[1] > 0) {
							continue FindNext;
						}

						// action[2] is the step size
						action[1] = action[2];

						break;
					}
				}
			}

			// if we made it this far, we found the next value to return
			return;
		}
	}

	public hasNext () {
		if (!this.savedNext.length) {
			this.next();
			if (this._done) {
				return false;
			}

			this.savedNext.push(this._value);
		}

		return true;
	}
}

(window as any).Stream = Stream;
