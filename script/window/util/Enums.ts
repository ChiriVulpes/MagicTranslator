import { tuple } from "util/Arrays";

module Enums {

	/**
	 * Iterate over the names of the entries in an enum.
	 */
	export function keys<T> (enumObject: T): Stream<keyof T> {
		return Stream.keys(enumObject)
			.filter(key => isNaN(+key)) as any;
	}

	/**
	 * Iterate over the values in an enum.
	 */
	export function values<T> (enumObject: T): Stream<T[keyof T]> {
		return keys(enumObject).map(key => enumObject[key]);
	}

	/**
	 * Iterate over the entries in an enum. Yields a tuple containing the name and value of each entry.
	 */
	export function entries<T> (enumObject: T): Stream<[keyof T, T[keyof T]]> {
		return keys(enumObject)
			.map(key => tuple(key, enumObject[key]));
	}
}

export default Enums;
