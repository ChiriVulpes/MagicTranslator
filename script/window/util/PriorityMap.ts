/**
 * Used for ordering a list of items by "priority". Higher priorities come before lower priorities.
 */
export default class PriorityMap<T> {

	public static streamAll<T extends Iterable<any>> (...lists: PriorityMap<T>[]) {
		return lists.stream()
			.flatMap(list => list.priorities)
			.distinct()
			.sorted()
			.flatMap(priority => lists.stream()
				.filter(list => priority in list.map)
				.map(list => list.map[priority]));
	}

	private readonly priorities: number[] = [];
	private readonly map: { [key: number]: T } = {};

	public getOrDefault (priority: number): T | undefined;
	public getOrDefault (priority: number, orDefault: (priority: number) => T, assign?: boolean): T;
	public getOrDefault (priority: number, orDefault?: (priority: number) => T, assign?: boolean): T | undefined;
	public getOrDefault (priority: number, orDefault?: (priority: number) => T, assign = false) {
		let value = this.map[priority];

		if (!(priority in this.map) && orDefault) {
			value = orDefault(priority);
			if (assign) {
				this.map[priority] = value;
				this.priorities.push(priority);
				this.priorities.sort();
			}
		}

		return value;
	}

	/**
	 * Returns an iterator of the items in this list.
	 */
	public stream (direction = PriorityListStreamDirection.HighestToLowest) {
		return this.priorities.stream(direction)
			.map(priority => this.map[priority]);
	}
}

export const enum PriorityListStreamDirection {
	HighestToLowest = -1,
	LowestToHighest = 1,
}
