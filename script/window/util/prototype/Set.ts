import Stream from "util/stream/Stream";

// tslint:disable-next-line no-mergeable-namespace
declare global {
	interface Set<T> {

		/**
		 * Returns a Stream for the values of this Set.
		 */
		stream (): Stream<T>;
	}
}

export default function () {
	Object.defineProperty(Set.prototype, "stream", {
		value (this: Set<any>) {
			return Stream.from(this);
		},
	});
}
