export interface Streamable<T> {
	value: T;
	done: boolean;
	/**
	 * Resolves the next item in this Stream. Updates `done` and `value`.
	 */
	next (): void;
}
