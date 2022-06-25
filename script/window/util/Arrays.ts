import { generalRandom } from "util/Random";

/**
 * This is functionally identical to `as const`, except it only works on primitives.
 * But it's shorter!
 */
export function exact<T extends string | number | boolean | null | undefined> (item: T): T;
export function exact<T> (item: T): T {
	return item;
}

export function tuple<T extends any[]> (...items: T): T {
	return items;
}

namespace Arrays {

	/**
	 * Shuffles the contents of the given array using the Fisher-Yates Shuffle: https://bost.ocks.org/mike/shuffle/
	 * @returns The given array after shuffling its contents.
	 */
	export function shuffle<T> (arr: T[], r = generalRandom): T[] {
		let currentIndex = arr.length;
		let temporaryValue: T;
		let randomIndex: number;

		while (0 !== currentIndex) {
			randomIndex = r.int(currentIndex);
			currentIndex -= 1;
			temporaryValue = arr[currentIndex];
			arr[currentIndex] = arr[randomIndex];
			arr[randomIndex] = temporaryValue;
		}

		return arr;
	}
}

export default Arrays;
