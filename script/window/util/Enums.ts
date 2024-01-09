import { tuple } from "util/Arrays";

namespace Enums {

	/**
	 * Iterate over the names of the entries in an enum.
	 */
	export function keys<T extends object> (enumObject: T): (keyof T)[] {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return (Object.keys(enumObject) as Array<Extract<keyof T, string | number>>)
			.filter((key): key is Extract<keyof T, string | number> => isNaN(+key));
	}

	/**
	 * Iterate over the values in an enum.
	 */
	export function values<T extends object> (enumObject: T): (T[keyof T])[] {
		return keys(enumObject).map(key => enumObject[key]);
	}

	/**
	 * Iterate over the entries in an enum. Yields a tuple containing the name and value of each entry.
	 */
	export function entries<T extends object> (enumObject: T): [keyof T, T[keyof T]][] {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return keys(enumObject)
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
			.map(key => tuple(key, enumObject[key]));
	}
}

export default Enums;
