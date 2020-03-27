import { tuple } from "util/Arrays";

export default class IndexedMap<K, V> extends Map<K, V> {
	public static create<K, V> (entriesIterable: Iterable<[K, V]>) {
		const result = new IndexedMap<K, V>();
		result.addAll(entriesIterable);
		return result;
	}

	public static createAsync<K, V> (entriesIterable: AsyncIterable<[K, V]>) {
		return new Promise<IndexedMap<K, V>>(async resolve => {
			const result = new IndexedMap<K, V>();
			await result.addAllAsync(entriesIterable);
			resolve(result);
		});
	}

	private readonly indexMap: K[] = [];

	public constructor (entriesIterable?: Iterable<[K, V]>) {
		super();
		if (entriesIterable) {
			this.addAll(entriesIterable);
		}
	}

	@Override @Bound public get (key: K) {
		return super.get(key);
	}

	@Bound public getKey (index: number) {
		return this.indexMap[index];
	}

	public getByIndex<A> (index: number): V | undefined;
	public getByIndex<A> (index: number, orElse: () => A): V | A;
	@Bound public getByIndex<A> (index: number, orElse?: () => A) {
		return super.get(this.indexMap[index]) || (orElse ? orElse() : undefined);
	}

	@Override @Bound public set (key: K, value: V) {
		super.set(key, value);
		this.indexMap.push(key);

		return this;
	}

	@Override @Bound public delete (key: K) {
		const result = super.delete(key);
		const index = this.indexMap.indexOf(key);
		if (index >= 0) this.indexMap.splice(index, 1);

		return result;
	}

	@Override @Bound public clear () {
		this.indexMap.splice(0, Infinity);
	}

	/**
	 * Sets multiple entries in this map from an iterable of entries
	 */
	@Bound public addAll (...entriesIterable: Iterable<[K, V]>[]) {
		Stream.from(entriesIterable)
			.flatMap()
			.forEach(([k, v]) => this.set(k, v));

		return this;
	}

	/**
	 * Sets multiple entries in this map from an iterable of entries
	 */
	@Bound public async addAllAsync (...entriesIterable: (AsyncIterable<[K, V]> | Promise<AsyncIterable<[K, V]>>)[]) {
		for (const iterable of entriesIterable) {
			for await (const [k, v] of await iterable) {
				this.set(k, v);
			}
		}

		return this;
	}

	public indices () {
		return Stream.range(this.size);
	}

	/**
	 * Returns an iterator for the entries of this map, and the index of each.
	 */
	public indexedEntries () {
		return this.entries().map(([k, v]) => tuple(this.indexMap.indexOf(k), k, v));
	}
}
