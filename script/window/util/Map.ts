import Bound from "util/Bound";
import { tuple } from "util/IterableIterator";

export default class IndexedMap<K, V> extends Map<K, V> {
	public static create<K, V> (entriesIterable: IterableOf<[K, V]>) {
		const result = new IndexedMap<K, V>();
		result.setAll(entriesIterable);
		return result;
	}

	public static createAsync<K, V> (entriesIterable: AsyncIterableIterator<[K, V]>) {
		return new Promise<IndexedMap<K, V>>(async resolve => {
			const result = new IndexedMap<K, V>();
			await result.setAll(entriesIterable);
			resolve(result);
		});
	}

	private readonly indexMap: K[] = [];

	public constructor(...entriesIterable: IterableIterator<[K, V]>[]) {
		super();
		this.addAll(...entriesIterable);
	}

	@Bound
	public get (key: K) {
		return super.get(key);
	}

	@Bound
	public getKey (index: number) {
		return this.indexMap[index];
	}

	@Bound
	public getByIndex (index: number) {
		return super.get(this.indexMap[index]);
	}

	@Bound
	public set (key: K, value: V) {
		super.set(key, value);
		this.indexMap.push(key);

		return this;
	}

	@Bound
	public delete (key: K) {
		const result = super.delete(key);
		const index = this.indexMap.indexOf(key);
		if (index >= 0) this.indexMap.splice(index, 1);

		return result;
	}

	@Bound
	public clear () {
		this.indexMap.splice(0, Infinity);
	}

	/**
	 * Sets multiple entries in this map from an iterable of entries
	 */
	@Bound
	public addAll (...entriesIterable: IterableOf<[K, V]>[]) {
		entriesIterable.values()
			.flat<[K, V]>(1)
			.forEach(([k, v]) => this.set(k, v));

		return this;
	}

	/**
	 * Sets multiple entries in this map from an iterable of entries
	 */
	@Bound
	public async addAllAsync (...entriesIterable: (AsyncIterableIterator<[K, V]> | Promise<AsyncIterableIterator<[K, V]>>)[]) {
		for (const iterable of entriesIterable) {
			for await (const [k, v] of await iterable) {
				this.set(k, v);
			}
		}

		return this;
	}

	/**
	 * Returns an iterator for the entries of this map, and the index of each.
	 */
	public indexedEntries (): IterableIterator<[number, K, V]> {
		return this.entries().map(([k, v]) => tuple(this.indexMap.indexOf(k), k, v));
	}
}
