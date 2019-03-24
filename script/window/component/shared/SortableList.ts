import Component from "component/Component";
import { ComponentEvent } from "component/ComponentManipulator";
import { tuple } from "util/Arrays";
import Bound from "util/Bound";
import { Vector } from "util/math/Geometry";

export const enum SortableListEvent {
	SortUpdate = "sort-update",
	SortComplete = "sort-complete",
}

export class SortableListItem extends Component {
	public dragStart?: Vector;
	public dragEnd?: Vector;
	public positionStart?: number;
	private scrollStart: number;
	private lastMoveEvent?: MouseEvent;

	public constructor (tagname?: string) {
		super(tagname);
		this.classes.add("sortable-list-item");

		this.listeners.add("mousedown", this.mouseDown);
		this.listeners.add("click", this.mouseUp);
	}

	@Bound
	public mouseMove (event = this.lastMoveEvent) {
		this.lastMoveEvent = event;
		this.dragEnd = Vector.get(event!);

		const y = this.positionStart! + (this.dragEnd.y - this.dragStart!.y) + (this.parent!.element().scrollTop - this.scrollStart);
		this.style.set("--drag-y", y - this.parent!.element().scrollTop + this.parent!.box().top);

		if (!this.classes.has("sorting") && Math.abs(this.dragStart!.y - this.dragEnd.y) > 5) {
			this.classes.add("sorting");
			this.parent!.classes.add("sorting");

		}

		if (this.classes.has("sorting")) {
			this.emit<[SortableListItem, number]>(SortableListEvent.SortUpdate, updateEvent => updateEvent.data = tuple(this, y));
		}

		return y;
	}

	@Bound
	private mouseDown (event: MouseEvent) {
		if (Component.get(event) !== this) return;
		if (this.parent && !(this.parent instanceof SortableList)) return;

		const box = this.box();
		this.scrollStart = this.parent!.element().scrollTop;
		this.positionStart = box.top - this.parent!.box().top + this.scrollStart;
		this.dragStart = Vector.get(event);
		this.style.set("--width", box.width);
		this.style.set("--left", box.left);

		this.parent!.style.set("--sorting-wrapper-height", `${this.parent!.element().scrollHeight}px`);

		Component.window.listeners.add<MouseEvent>("mousemove", this.mouseMove);
		Component.window.listeners.add<MouseEvent>("mouseup", this.mouseUp);
	}

	@Bound
	private mouseUp (event: MouseEvent) {
		Component.window.listeners.remove<MouseEvent>("mousemove", this.mouseMove);
		Component.window.listeners.remove<MouseEvent>("mouseup", this.mouseUp);

		if (!this.classes.has("sorting")) return;

		const y = this.mouseMove(event);
		this.classes.remove("sorting");

		this.emit<[SortableListItem, number]>(SortableListEvent.SortComplete, completeEvent => completeEvent.data = tuple(this, y));

		this.parent!.style.remove("--sorting-wrapper-height");
	}
}

export default class SortableList<I extends SortableListItem = SortableListItem> extends Component {

	private _isSorting = false;
	private scrollSpeed = 0;
	private scrollAnimation: number | undefined;

	public get isSorting () {
		return this._isSorting;
	}

	public constructor () {
		super();
		this.classes.add("sortable-list");

		this.listeners.add("append-child", this.onAppendChild);
	}

	@Bound
	private onAppendChild (event: ComponentEvent<Component>) {
		const component = event.data;
		if (!(component instanceof SortableListItem)) {
			console.error("A sortable list may only have children that are 'SortableListItem's. Attempted to append:", component);
		}

		component
			.listeners.add(SortableListEvent.SortUpdate, this.updateMove)
			.listeners.add(SortableListEvent.SortComplete, this.completeMove);
	}

	@Bound
	private updateMove ({ data: [sortingComponent, y] }: ComponentEvent<[SortableListItem, number]>) {
		this._isSorting = true;
		this.style.set("--sorting-item-height", `${sortingComponent.box().height}px`);
		y += sortingComponent.box().height / 2;

		let totalY = 0;
		let lastComponent: SortableListItem | undefined;

		for (const sortableItem of this.children<SortableListItem>()) {
			if (sortableItem === sortingComponent) continue;

			sortableItem.classes.remove("sorting-before");

			const box = sortableItem.box();
			if (y >= totalY && y < totalY + box.height) {
				if (lastComponent) lastComponent.classes.remove("sorting-before");
				lastComponent = sortableItem.classes.add("sorting-before");
			}

			totalY += box.height;
		}

		this.updateScroll(y);
	}

	private updateScroll (y?: number) {
		if (!this._isSorting) return;

		if (y !== undefined) {
			if (this.scrollAnimation !== undefined) cancelAnimationFrame(this.scrollAnimation);

			const screenY = y - this.element().scrollTop;
			const capturesHeight = this.element().clientHeight;

			this.scrollSpeed = screenY < 100 ? (100 - screenY) / -2 :
				screenY > capturesHeight - 100 ? (screenY - (capturesHeight - 100)) / 2 : 0;
		}

		this.element().scrollTop += this.scrollSpeed;

		if (y === undefined) {
			this.descendants<SortableListItem>(".sorting").first()!.mouseMove();
		}

		this.scrollAnimation = requestAnimationFrame(() => this.updateScroll());
	}

	@Bound
	private completeMove ({ data: [sortingComponent, y] }: ComponentEvent<[SortableListItem, number]>) {
		y += sortingComponent.box().height / 2;

		let totalY = 0;
		let insertIndex = -1;

		for (const [index, component] of this.children<SortableListItem>().entries()) {
			if (component === sortingComponent) continue;

			const box = component.box();
			component.classes.remove("sorting-before");
			if (y >= totalY && y < totalY + box.height) {
				insertIndex = index;
			}

			totalY += box.height;
		}

		const beforeComponent = insertIndex === -1 ? undefined : this.children<SortableListItem>().at(insertIndex);

		if (beforeComponent) {
			this.element().insertBefore(sortingComponent.element(), beforeComponent.element());
		} else {
			this.append(sortingComponent);
		}

		this._isSorting = false;
		this.classes.remove("sorting");

		this.emit(SortableListEvent.SortComplete);
	}
}
