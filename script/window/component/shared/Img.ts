import type { TextGenerator } from "component/Component";
import Component from "component/Component";
import type { Events, IEventEmitter } from "util/EventEmitter";
import Translation from "util/string/Translation";

interface ImgEvents extends Events<Component> {
	load (): any;
	error (): any;
}

export default class Img extends Component {

	declare event: IEventEmitter<this, ImgEvents>;

	private altGenerator?: (component: any) => string | number;

	public constructor () {
		super("img");
		this.element<HTMLImageElement>().crossOrigin = "Anonymous";
		this.listeners.add("load", () => this.event.emit("load"));
		this.listeners.add("error", () => this.event.emit("error"));
	}

	public setSrc (src: string) {
		this.attributes.set("src", src);
		return this;
	}

	public setAlt (translation: TextGenerator<this>) {
		if (typeof translation === "string") translation = new Translation(translation);
		this.altGenerator = translation instanceof Translation ? translation.get : translation;
		this.refreshText();
		return this;
	}

	@Bound public override refreshText () {
		super.refreshText();
		const text = this.altGenerator ? this.altGenerator(this) : "";
		this.attributes.set("alt", text === null || text === undefined ? "" : `${text}`);
		return this;
	}
}
