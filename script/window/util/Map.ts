import Bound from "util/Bound";

export default class Map2<K, V> extends Map<K, V> {
	public constructor(...entriesIterable: IterableIterator<[K, V]>[]) {
		super();
		this.addAll(...entriesIterable);

		this.get = this.get.bind(this);
		this.set = this.set.bind(this);
	}

	/**
	 * Sets multiple entries in this map from an iterable of entries
	 */
	@Bound
	public addAll (...entriesIterable: IterableOf<[K, V]>[]) {
		for (const iterable of entriesIterable) for (const [key, value] of iterable) {
			this.set(key, value);
		}
	}
}
