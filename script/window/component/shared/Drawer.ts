import Component from "component/Component";
import { sleep } from "util/Async";

export enum DrawerClasses {
	Main = "drawer",
}

export interface DrawerOptions {
	width: "auto" | "match";
	/**
	 * The horizontal position on the host component that the drawer should be anchored to.
	 */
	position: "left" | "centre" | "right";
	/**
	 * The horizontal position of the drawer that it should anchor to the position.
	 */
	anchor: "left" | "centre" | "right";
}

export default class Drawer extends Component {

	private readonly options: DrawerOptions;
	private readonly openReasons = new Set<string>();

	public constructor (private readonly host: Component, options?: Partial<DrawerOptions>) {
		super();
		this.classes.add(DrawerClasses.Main);
		this.options = {
			width: "match",
			position: "left",
			anchor: "left",
			...options,
		};
		this.event.subscribe("appendChild", () => sleep(0.01).then(() => this.refresh));
		document.body.appendChild(this.element());
		host.event.subscribe("remove", this.remove);
		this.listeners.add("mouseenter", () => this.open("self:hover"));
		this.listeners.add("mouseleave", () => this.close("self:hover"));
		this.close("");
	}

	@Bound public refresh () {
		const hostBox = this.host.box();
		this.style.set("width", this.options.width === "auto" ? "auto" : `${hostBox.width}px`);
		this.style.set("top", hostBox.bottom, "px");

		const box = this.box();
		const anchor = this.options.anchor === "left" ? 0 : this.options.anchor === "centre" ? box.width / 2 : box.width;
		const position = this.options.position === "left" ? hostBox.left : this.options.anchor === "centre" ? hostBox.left + hostBox.width / 2 : hostBox.left + hostBox.width;
		this.style.set("left", position - anchor, "px");
	}

	public open (reason: string) {
		this.openReasons.add(reason);
		this.show();
		this.attributes.remove("inert");
		return this;
	}

	public close (reason: string) {
		this.openReasons.delete(reason);
		if (!this.openReasons.size) {
			this.hide(true);
			this.attributes.set("inert");
		}
		return this;
	}

	public toggleOpen (reason: string) {
		this.openReasons.toggle(!this.openReasons.has(reason), reason);
		return this;
	}

	public isOpenFor (reason: string) {
		return this.openReasons.has(reason);
	}
}
