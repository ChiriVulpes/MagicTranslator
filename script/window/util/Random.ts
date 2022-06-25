
export interface RandomGenerator {
	get (): number;
}

export class Random<G extends RandomGenerator = RandomGenerator> {
	public generator: G;

	constructor (generator: G) {
		this.generator = generator;
	}

	public float (): number;
	public float (max: number): number;
	public float (min: number, max: number): number;
	public float (min?: number, max?: number) {
		if (max === undefined) {
			max = min === undefined ? 1 : min;
			min = 0;
		}

		return min! + (this.generator.get() * (max - min!));
	}

	/**
	 * Generates a random integer between 0 (inclusive) and max (exclusive)
	 */
	public int (max: number) {
		return Math.floor(this.generator.get() * max);
	}

	/**
	 * Generates a random integer between min and max (inclusive)
	 */
	public intInRange (min: number, max: number) {
		return Math.floor(this.generator.get() * (max - min + 1)) + Math.ceil(min);
	}

	/**
	 * Generates a random boolean
	 */
	public bool () {
		return this.generator.get() > 0.5;
	}

	/**
	 * Get a percentage for something
	 * Returns a number between 1 and 100 (inclusive)
	 */
	public percent (minChance = 0, chanceOutOf = 100, ceil = true) {
		return ceil ? Math.ceil(this.generator.get() * chanceOutOf) - minChance : this.generator.get() * chanceOutOf - minChance;
	}

	/**
	 * Returns whether a chance passes, given a decimal number.
	 *
	 * Example: `chance(0.1)` is a `1/10` chance, `chance(0.8)` is a `4/5` chance
	 */
	public chance (decimal: number) {
		return this.generator.get() < decimal;
	}

	/**
	 * Chooses a random entry in an array and returns it
	 */
	public choice<A extends any[]> (...from: A): A[number] {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return from[this.int(from.length)];
	}

	public shuffle<T> (array: T[]) {
		for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(this.generator.get() * (i + 1));
			const temp = array[i];
			array[i] = array[j];
			array[j] = temp;
		}

		return array;
	}

	public getElement<T> (array: T[]): T {
		return array[this.int(array.length)];
	}

	/**
	 * Returns a random T from the given choices, where each choice is weighted by a number. Higher numbers = higher chance.
	 */
	@Bound public weightedChoice<T> (choices: [number, T][]): T {
		const total = choices.reduce((totalWeight, [weight]) => totalWeight + weight, 0);
		const choice = this.float(total);

		let cursor = 0;
		let i = 0;
		for (; i < choices.length; i++) {
			cursor += choices[i][0];
			if (cursor >= choice) {
				break;
			}
		}

		return choices[i][1];
	}
}

export const generalRandom = new Random({ get: () => Math.random() });
