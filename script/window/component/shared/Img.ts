import Component, { TextGenerator } from "component/Component";
import { Events, IEventEmitter } from "util/EventEmitter";
import Translation from "util/string/Translation";

interface ImgEvents extends Events<Component> {
	load (): any;
}

export default class Img extends Component {

	@Override public readonly event: IEventEmitter<this, ImgEvents>;

	private altGenerator?: (component: any) => string | number;

	public constructor () {
		super("img");
		this.element<HTMLImageElement>().crossOrigin = "Anonymous";
		this.listeners.add("load", () => this.event.emit("load"));
	}

	public setSrc (src: string) {
		this.attributes.set("src", src.startsWith("chiri") ? src : `chiri://${src}`);
		return this;
	}

	public setAlt (translation: TextGenerator<this>) {
		if (typeof translation === "string") translation = new Translation(translation);
		this.altGenerator = translation instanceof Translation ? translation.get : translation;
		this.refreshText();
		return this;
	}

	@Bound @Override public refreshText () {
		super.refreshText();
		const text = this.altGenerator ? this.altGenerator(this) as any : "";
		this.attributes.set("alt", text === null || text === undefined ? "" : `${text}`);
		return this;
	}
}
