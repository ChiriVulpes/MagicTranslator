import { Streamable } from "util/stream/IStream";
import Stream from "util/stream/Stream";

declare global {
	interface RegExp {
		/**
		 * Returns a Stream for the matches of this string.
		 */
		matches (string: string): Stream<RegExpExecArray>;
	}
}

export default function () {
	Object.defineProperty(RegExp.prototype, "matches", {
		value (this: RegExp, str: string) {
			return Stream.from(new StreamableMatches(this, str));
		},
	});
}

class StreamableMatches implements Streamable<RegExpExecArray> {

	private _done = false;
	private _value: RegExpExecArray | null;

	public get value () { return this._value!; }
	public get done () { return this._done; }

	public constructor (private readonly regex: RegExp, private readonly str: string) { }

	public next () {
		if (this._done) {
			return;
		}

		this._value = this.regex.exec(this.str);
		if (!this._value) {
			this._done = true;
		}
	}
}
