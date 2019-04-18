export class Box implements ClientRect {
	public readonly top: number;
	public readonly bottom: number;
	public readonly height: number;
	public readonly width: number;
	public readonly left: number;
	public readonly right: number;

	public constructor (rect: ClientRect) {
		this.top = rect.top;
		this.bottom = rect.bottom;
		this.width = rect.width;
		this.height = rect.height;
		this.left = rect.left;
		this.right = rect.right;
	}

	public intersects (...things: (Box | Vector)[]) {
		return !things.some(thing => !this.doesIntersect(thing));
	}

	public position () {
		return new Vector(this.left, this.top);
	}

	public size () {
		return new Vector(this.width, this.height);
	}

	private doesIntersect (boxOrPoint: Box | Vector) {
		if (boxOrPoint instanceof Vector)
			return this.top <= boxOrPoint.y && this.bottom > boxOrPoint.y && this.left <= boxOrPoint.x && this.right > boxOrPoint.x;

		return this.top < boxOrPoint.bottom && this.bottom > boxOrPoint.top && this.left < boxOrPoint.right && this.right > boxOrPoint.left;
	}
}

export class Vector {
	public static get ZERO () { return new Vector(0); }
	public static get ONE () { return new Vector(1); }

	public static get (event: MouseEvent) {
		return new Vector(event.clientX, event.clientY);
	}

	public static getNaturalSize (element: HTMLImageElement) {
		return new Vector(element.naturalWidth, element.naturalHeight);
	}

	public static size (a: { x: number; y: number }, b: { x: number; y: number }) {
		return new Vector(a).minus(b).abs();
	}

	public static min (a: { x: number; y: number }, b: { x: number; y: number }) {
		return new Vector(Math.min(a.x, b.x), Math.min(a.y, b.y));
	}

	public static max (a: { x: number; y: number }, b: { x: number; y: number }) {
		return new Vector(Math.max(a.x, b.x), Math.max(a.y, b.y));
	}

	public x: number;
	public y: number;

	public constructor (xAndY: number);
	public constructor (vector: { x: number; y: number });
	public constructor (x: number, y: number);
	public constructor (x: number | { x: number; y: number }, y?: number);
	public constructor (x: number | { x: number; y: number }, y = x as number) {
		if (typeof x === "object") {
			this.x = x.x;
			this.y = x.y;
			return;
		}

		this.x = x;
		this.y = y;
	}

	public plus (xAndY: number): Vector;
	public plus (vector: { x: number; y: number }): Vector;
	public plus (vector: number | { x: number; y: number }): Vector;
	public plus (vector: number | { x: number; y: number }) {
		return new Vector(
			this.x + (typeof vector === "number" ? vector : vector.x),
			this.y + (typeof vector === "number" ? vector : vector.y),
		);
	}

	public minus (xAndY: number): Vector;
	public minus (vector: { x: number; y: number }): Vector;
	public minus (vector: number | { x: number; y: number }): Vector;
	public minus (vector: number | { x: number; y: number }) {
		return new Vector(
			this.x - (typeof vector === "number" ? vector : vector.x),
			this.y - (typeof vector === "number" ? vector : vector.y),
		);
	}

	public times (xAndY: number): Vector;
	public times (vector: { x: number; y: number }): Vector;
	public times (vector: number | { x: number; y: number }): Vector;
	public times (vector: number | { x: number; y: number }) {
		return new Vector(
			this.x * (typeof vector === "number" ? vector : vector.x),
			this.y * (typeof vector === "number" ? vector : vector.y),
		);
	}

	public over (xAndY: number): Vector;
	public over (vector: { x: number; y: number }): Vector;
	public over (vector: number | { x: number; y: number }): Vector;
	public over (vector: number | { x: number; y: number }) {
		return new Vector(
			this.x / (typeof vector === "number" ? vector : vector.x),
			this.y / (typeof vector === "number" ? vector : vector.y),
		);
	}

	public abs () {
		return new Vector(Math.abs(this.x), Math.abs(this.y));
	}

	public floor () {
		return new Vector(Math.floor(this.x), Math.floor(this.y));
	}

	public round () {
		return new Vector(Math.round(this.x), Math.round(this.y));
	}

	public raw () {
		return { x: this.x, y: this.y };
	}
}
