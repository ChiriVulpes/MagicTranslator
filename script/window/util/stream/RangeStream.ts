import { Streamable } from "util/stream/IStream";

export default class RangeStream implements Streamable<number> {

	private readonly step: number;
	private _done = false;
	private _value: number;

	public get value () { return this._value; }
	public get done () { return this._done; }

	public constructor (start: number, private readonly end: number, step: number) {
		if (end === start) {
			this._done = true;
		}

		step = Math.abs(step) * (start > end ? -1 : 1);

		this.step = step;
		this._value = start - step;
	}

	public next () {
		if (this._done) {
			return;
		}

		this._value += this.step;
		if (this.step > 0 ? this._value >= this.end : this._value <= this.end) {
			this._done = true;
		}
	}
}
