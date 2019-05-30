import Component from "component/Component";
import { sleep } from "util/Async";
import EventEmitter, { Events } from "util/EventEmitter";
import { Vector } from "util/math/Geometry";
import Stream from "util/stream/Stream";

interface SortableTilesEvents extends Events<Component> {
	sort (): any;
}

export default class SortableTiles<T extends Component> extends Component {

	@Override public readonly event: EventEmitter<this, SortableTilesEvents>;

	public constructor (private readonly variablySized?: "vertical" | "horizontal") {
		super();
		this.classes.add("sortable-tiles");
	}

	public isSorting () {
		return this.classes.has("sorting");
	}

	public tiles () {
		return this.children<SortableTile<T>>()
			.map(child => child instanceof SortableTile ? child.content : child);
	}

	@Bound public addTile (content: T, sortable = true) {
		new SortableTile<T>(content, sortable, this.variablySized)
			.event.subscribe("moved", () => this.event.emit("sort"))
			.appendTo(this);
	}
}

interface LastMove {
	position: Vector;
	movement: Vector;
	after?: Element;
	before?: Element;
}

interface SortableTileEvents extends Events<Component> {
	moved (): any;
}

const disallowSortingWhenHovered = Stream.of("button", "input", "textarea", "a")
	.flatMap(c => (c = `${c}:not(.allows-propagation):not(.disabled)`, [c, `${c} *`]))
	.toString(",");

class SortableTile<T extends Component> extends Component {

	@Override public readonly event: EventEmitter<this, SortableTileEvents>;

	private mouseOffset: Vector;
	private lastMove?: LastMove;

	public constructor (public readonly content: T, sortable: boolean, private readonly variablySized?: "vertical" | "horizontal") {
		super();
		this.classes.add("sortable-tile");
		this.classes.toggle(!sortable, "immobile");
		content.appendTo(this)
			.event.subscribe("remove", this.remove);

		if (sortable) this.listeners.add("mousedown", this.onMouseDown);
	}

	public getCenter () {
		const box = this.content.box();
		return box.position().plus(box.size().over(2));
	}

	@Bound private async onMouseDown (event: MouseEvent) {
		event.stopPropagation();

		const target = Component.get(event);
		if (target.matches(disallowSortingWhenHovered)) return;

		const box = this.box();
		const position = box.position();
		this.mouseOffset = Vector.get(event).minus(position);

		Component.window.listeners.add("mouseup", this.onMouseUp);

		this.lastMove = {
			position,
			movement: Vector.ZERO,
		};

		this.classes.add("will-move");

		const child = this.child(0)!;
		const childBox = child.box();

		await sleep(0.12);
		if (!this.classes.has("will-move")) return;
		this.classes.remove("will-move").classes.add("moving");
		this.parent!.classes.add("sorting");

		this.style.set("width", box.width);
		this.style.set("height", box.height);
		child.style.set("width", childBox.width);
		child.style.set("height", childBox.height);

		this.onMouseMove(event);
		Component.window.listeners.add("mousemove", this.onMouseMove);
	}

	@Bound private onMouseMove (event: MouseEvent) {
		const mouse = Vector.get(event);
		const position = mouse.minus(this.mouseOffset);
		this.style.set("--preview-left", position.x);
		this.style.set("--preview-top", position.y);

		const center = this.getCenter();
		const hoveredTile = document.elementsFromPoint(center.x, center.y)
			.find(element => element.matches(".sorting > .sortable-tile:not(.immobile):not(.moving)"));
		if (hoveredTile && hoveredTile !== this.element()) {
			const isAfter = Component.get(hoveredTile).getIndex()! < this.getIndex()!;
			const movement = this.lastMove ? position.minus(this.lastMove.position) : Vector.ZERO;
			const pivot = isAfter ? "before" : "after";

			if (!this.shouldMove(pivot, hoveredTile, movement)) return;

			const move: LastMove = {
				position,
				movement,
				[pivot]: hoveredTile,
			};

			this.appendTo(this.parent!, move as any);
			this.lastMove = move;
		}
	}

	private shouldMove (pivot: "after" | "before", hoveredTile: Element, movement: Vector) {
		if (!this.lastMove || (this.lastMove.before !== hoveredTile && this.lastMove.after !== hoveredTile))
			return true;

		// if we're going to be put in the same place anyway, cancel
		if (hoveredTile === this.element()[pivot === "before" ? "nextElementSibling" : "previousElementSibling"])
			return false;

		if (!this.variablySized) return true;

		// We switched which side we want to pivot to, on the same element as last time.
		// If the element we're pivoting on is bigger than this element, that means that every mouse movement,
		// the pivot could switch directions.
		// To prevent that, we check if the *mouse* changed directions as well.

		// If it didn't, we cancel this movement.
		if (this.variablySized === "horizontal")
			return Math.sign(this.lastMove.movement.x) !== Math.sign(movement.x);
		else
			return Math.sign(this.lastMove.movement.y) !== Math.sign(movement.y);
	}

	@Bound private onMouseUp (event: MouseEvent) {
		this.style.remove("width");
		this.style.remove("height");
		const child = this.child(0);
		if (child) {
			child.style.remove("width");
			child.style.remove("height");
		}

		Component.window.listeners.remove("mousemove", this.onMouseMove);
		Component.window.listeners.remove("mouseup", this.onMouseUp);

		if (this.classes.has("moving")) this.event.emit("moved");

		this.classes.remove("will-move", "moving");
		const parent = this.parent;
		if (parent) parent.classes.remove("sorting");
	}
}
