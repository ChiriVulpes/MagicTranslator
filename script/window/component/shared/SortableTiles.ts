import Component from "component/Component";
import { sleep } from "util/Async";
import { Vector } from "util/math/Geometry";

export default class SortableTiles<T extends Component> extends Component {
	public constructor () {
		super();
		this.classes.add("sortable-tiles");
	}

	public tiles () {
		return this.children<SortableTile<T>>()
			.map(child => child instanceof SortableTile ? child.content : child);
	}

	public addTile (content: T, sortable = true) {
		new SortableTile<T>(content, sortable)
			.listeners.add("moved", () => this.emit("sort"))
			.appendTo(this);
	}
}

class SortableTile<T extends Component> extends Component {

	private mouseOffset: Vector;

	public constructor (public readonly content: T, sortable = true) {
		super();
		this.classes.add("sortable-tile");
		this.classes.toggle(!sortable, "immobile");
		content.appendTo(this)
			.listeners.add("remove", this.remove);

		if (sortable) this.listeners.add("mousedown", this.onMouseDown);
	}

	public getCenter () {
		const box = this.content.box();
		return box.position().plus(box.size().over(2));
	}

	@Bound private async onMouseDown (event: MouseEvent) {
		const box = this.box();
		this.mouseOffset = Vector.get(event).minus(box.position());

		Component.window.listeners.add("mouseup", this.onMouseUp);

		this.classes.add("will-move");

		await sleep(0.12);
		if (!this.classes.has("will-move")) return;
		this.classes.remove("will-move").classes.add("moving");
		this.parent!.classes.add("sorting");

		this.style.set("width", box.width);
		this.style.set("height", box.height);

		this.onMouseMove(event);
		Component.window.listeners.add("mousemove", this.onMouseMove);
	}

	@Bound private onMouseMove (event: MouseEvent) {
		const mouse = Vector.get(event);
		const position = mouse.minus(this.mouseOffset);
		this.style.set("--preview-left", position.x);
		this.style.set("--preview-top", position.y);

		const center = this.getCenter();
		const hoveredElement = document.elementFromPoint(center.x, center.y);
		const hoveredTile = hoveredElement && hoveredElement.closest(".sortable-tile:not(.immobile)");
		if (hoveredTile && hoveredTile !== this.element()) {
			const isAfter = Component.get(hoveredTile).getIndex()! > this.getIndex()!;
			this.appendTo(this.parent!, isAfter ? { after: hoveredTile } : { before: hoveredTile });
		}
	}

	@Bound private onMouseUp (event: MouseEvent) {
		this.style.remove("width");
		this.style.remove("height");

		Component.window.listeners.remove("mousemove", this.onMouseMove);
		Component.window.listeners.remove("mouseup", this.onMouseUp);

		if (this.classes.has("moving")) this.emit("moved");

		this.classes.remove("will-move", "moving");
		this.parent!.classes.remove("sorting");
	}
}
