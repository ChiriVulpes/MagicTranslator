import { Streamable } from "util/stream/IStream";
import Stream, { IPartitions } from "util/stream/Stream";

export default class Partitions<T, K> implements IPartitions<K, T> {

	private readonly _partitions: Map<K, [Partition<T>, Stream<T>]> = new Map();
	private readonly partitionKeys: K[] = [];
	private partitionKeyIndex = 0;

	private _value: [K, Stream<T>];
	private _done = false;
	private index = 0;

	public get value () { return this._value; }
	public get done () { return this._done; }

	public constructor (
		private readonly stream: Streamable<T>,
		private readonly sorter: (val: T, index: number) => K,
		private readonly streamMapper: <V>(val: Streamable<V>) => Stream<V>,
	) { }

	public get (key: K) {
		return this.getPartition(key)[1];
	}

	public partitions () {
		return this.streamMapper(this);
	}

	public next () {
		let key: K;
		let partitionStream: Stream<T>;
		if (this.partitionKeyIndex < this.partitionKeys.length) {
			key = this.partitionKeys[this.partitionKeyIndex++];
			[, partitionStream] = this.getPartition(key);
			this._value = [key, partitionStream];
			return;
		}

		while (true) {
			this.stream.next();
			if (this.stream.done) {
				this._done = true;
				return;
			}

			let willContinue = false;
			const sortedKey = this.sorter(this.stream.value, this.index++);
			if (this._partitions.has(sortedKey)) {
				willContinue = true;
			}

			let partition: Partition<T>;
			[partition, partitionStream] = this.getPartition(sortedKey);
			partition.add(this.stream.value);

			if (willContinue) {
				continue;
			}

			this._value = [sortedKey, partitionStream];
			this.partitionKeyIndex++;
			break;
		}
	}

	private getPartition (key: K): [Partition<T>, Stream<T>] {
		let partition = this._partitions.get(key);
		if (partition === undefined) {
			this.partitionKeys.push(key);
			const partitionStream = new Partition<T>(this.getFunctionForRetrievingNextInPartition(key));
			this._partitions.set(key, partition = [partitionStream, this.streamMapper(partitionStream)]);
		}

		return partition;
	}

	private getFunctionForRetrievingNextInPartition (key: K) {
		return () => {
			while (true) {
				this.stream.next();
				if (this.stream.done) {
					return { done: true, value: undefined };
				}

				const sortedKey = this.sorter(this.stream.value, this.index++);
				if (sortedKey === key) {
					return { done: false, value: this.stream.value };
				}

				const [partition] = this.getPartition(sortedKey);
				partition.add(this.stream.value);
			}
		};
	}
}

class Partition<T> implements Streamable<T> {
	private readonly items: T[] = [];
	private index = 0;

	private _value: T;
	private _done = false;

	public get value () { return this._value; }
	public get done () { return this._done; }

	public constructor (private readonly getNext: () => { done: boolean; value?: T }) { }

	public next () {
		if (this.index < this.items.length) {
			this._value = this.items[this.index++];
			return;
		}

		const value = this.getNext();
		if (value.done) {
			this._done = true;
			return;
		}

		this._value = value.value!;
	}

	public add (...items: T[]) {
		this.items.push(...items);
	}
}
