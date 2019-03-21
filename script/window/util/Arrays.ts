import { generalRandom } from "util/Random";

export function tuple<T extends any[]> (...items: T): T {
	return items;
}

module Arrays {

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
