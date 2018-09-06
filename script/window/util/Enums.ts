
module Enums {
	/**
	 * Iterate over the names of the entries in an enum.
	 */
	export function* keys<E, K extends string> (enumObject: { [key in K]: E }): IterableIterator<K> {
		for (const key in enumObject) {
			if (isNaN(+key)) {
				yield key as K;
			}
		}
	}

	/**
	 * Iterate over the values in an enum.
	 */
	export function* values<E, K extends string> (enumObject: { [key in K]: E }): IterableIterator<E> {
		for (const key of keys(enumObject)) {
			yield enumObject[key];
		}
	}

	/**
	 * Iterate over the entries in an enum. Yields a tuple containing the name and value of each entry.
	 */
	export function* entries<E, K extends string> (enumObject: { [key in K]: E }): IterableIterator<[K, E]> {
		for (const key of keys(enumObject)) {
			yield [key, enumObject[key]];
		}
	}
}

export default Enums;
