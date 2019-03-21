import { tuple } from "util/Arrays";
import { Streamable } from "util/stream/IStream";
import Stream from "util/stream/Stream";

declare global {
	interface Array<T> {

		/**
		 * Returns a Stream for the values of this array.
		 * @param step If not provided, walks through the array one item at a time. If a positive number, walks forwards, every
		 * `step` entries. If a negative number, walks backwards through the array.
		 */
		stream (step?: number): Stream<T>;

		/**
		 * Returns a Stream for the index-value tuple entries of this array.
		 * @param step If not provided, walks through the array one item at a time. If a positive number, walks forwards, every
		 * `step` entries. If a negative number, walks backwards through the array.
		 */
		entryStream (step?: number): Stream<[number, T]>;

		/**
		 * Returns the last item in this array, or `undefined` if there are no items in this array.
		 */
		last (): T | undefined;

		/**
		 * Returns a value of type X, generated with the given collector function.
		 * @param collector A function that takes the iterable, and returns type X
		 * @see `utilities/Collectors` for premade collectors
		 */
		collect<X> (collector: (val: T[]) => X): X;
		/**
		 * Returns a value of type X, generated with the given collector function.
		 * @param collector A function that takes the iterable, and returns type X
		 * @see `utilities/Collectors` for premade collectors
		 */
		collect<X, A extends any[]> (collector: (val: T[], ...args: A) => X, ...args: A): X;
	}

	interface ReadonlyArray<T> {

		/**
		 * Returns a Stream for the values of this array.
		 * @param step If not provided, walks through the array one item at a time. If a positive number, walks forwards, every
		 * `step` entries. If a negative number, walks backwards through the array.
		 */
		stream (step?: number): Stream<T>;

		/**
		 * Returns a Stream for the index-value tuple entries of this array.
		 * @param step If not provided, walks through the array one item at a time. If a positive number, walks forwards, every
		 * `step` entries. If a negative number, walks backwards through the array.
		 */
		entryStream (step?: number): Stream<[number, T]>;

		/**
		 * Returns the last item in this array, or `undefined` if there are no items in this array.
		 */
		last (): T | undefined;

		/**
		 * Returns a value of type X, generated with the given collector function.
		 * @param collector A function that takes the iterable, and returns type X
		 * @see `utilities/Collectors` for premade collectors
		 */
		collect<X> (collector: (val: T[]) => X): X;
		/**
		 * Returns a value of type X, generated with the given collector function.
		 * @param collector A function that takes the iterable, and returns type X
		 * @see `utilities/Collectors` for premade collectors
		 */
		collect<X, A extends any[]> (collector: (val: T[], ...args: A) => X, ...args: A): X;
	}
}

export default function () {
	Object.defineProperty(Array.prototype, "stream", {
		value (this: any[], step = 1) {
			if (step === 1) {
				return Stream.from(this);
			}

			return Stream.from(new ArrayStream(this, step));
		},
	});

	Object.defineProperty(Array.prototype, "entryStream", {
		value (this: any[], step = 1) {
			return Stream.from(new ArrayEntriesStream(this, step));
		},
	});

	Object.defineProperty(Array.prototype, "last", {
		value (this: any[]) {
			return this[this.length - 1];
		},
	});

	Object.defineProperty(Array.prototype, "collect", {
		value (this: any[], collector: (val: any, ...args: any[]) => any, ...args: any[]) {
			return collector(this, ...args);
		},
	});
}

class InternalArrayStream<T> {
	protected index: number;
	private _done = false;
	private readonly step: number;

	public get done () { return this._done; }

	public constructor (protected readonly array: T[], step: number) {
		if (step === 0 || !Number.isInteger(step)) {
			console.error("[ArrayStream]", `Step "${step}" is invalid. Must be a non-zero positive or negative integer.`);
			step = 1;
		}

		this.step = step;
		this.index = step > 0 ? -1 : array.length;
	}

	public next () {
		if (this._done) {
			return;
		}

		this.index += this.step;
		if (this.step > 0 ? this.index >= this.array.length : this.index < 0) {
			this._done = true;
		}
	}
}

class ArrayStream<T> extends InternalArrayStream<T> implements Streamable<T> {
	public get value () { return this.array[this.index]; }
	public constructor (array: T[], step: number) {
		super(array, step);
	}
}

class ArrayEntriesStream<T> extends InternalArrayStream<T> implements Streamable<[number, T]> {
	public get value () { return tuple(this.index, this.array[this.index]); }
	public constructor (array: T[], step: number) {
		super(array, step);
	}
}
