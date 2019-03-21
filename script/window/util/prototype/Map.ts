import Stream from "util/stream/Stream";

// tslint:disable-next-line no-mergeable-namespace
declare global {
	interface Map<K, V> {

		/**
		 * If the given key is present in this map, returns the value associated with it. If the given key is not present,
		 * the `defaultGenerator` parameter is called and returned.
		 * @param key The key.
		 * @param defaultGenerator A function which will return the value for this key if it is not present.
		 * @param assign Whether the generated default will be stored in the map. Defaults to `false`
		 */
		getOrDefault<K2 extends K> (key: K2, defaultGenerator: (key: K2) => V, assign?: boolean): V;

		/**
		 * Returns a Stream for the values of this Map.
		 *
		 * Note: Alias of `map.values().stream()`
		 */
		valueStream (): Stream<V>;

		/**
		 * Returns a Stream for the keys of this Map.
		 *
		 * Note: Alias of `map.keys().stream()`
		 */
		keyStream (): Stream<K>;

		/**
		 * Returns a Stream for key-value tuple entries of this Map.
		 *
		 * Note: Alias of `map.entries().stream()`
		 */
		entryStream (): Stream<[K, V]>;
	}
}

export default function () {

	Object.defineProperty(Map.prototype, "getOrDefault", {
		value (this: Map<any, any>, key: any, value: (key: any) => any, assign = false) {
			if (this.has(key)) {
				return this.get(key);
			}

			value = value(key);
			if (assign) {
				this.set(key, value);
			}

			return value;
		},
	});

	Object.defineProperty(Map.prototype, "valueStream", {
		value (this: Map<any, any>) {
			return this.values().stream();
		},
	});

	Object.defineProperty(Map.prototype, "keyStream", {
		value (this: Map<any, any>) {
			return this.keys().stream();
		},
	});

	Object.defineProperty(Map.prototype, "entryStream", {
		value (this: Map<any, any>) {
			return this.entries().stream();
		},
	});
}
