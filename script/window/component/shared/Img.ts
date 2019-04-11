import Component, { TextGenerator } from "component/Component";
import Translation from "util/string/Translation";

export default class Img extends Component {
	private altGenerator: () => string | number;

	public constructor () {
		super("img");
	}

	public setSrc (src: string) {
		this.attributes.set("src", src);
		return this;
	}

	public setAlt (translation: TextGenerator) {
		if (typeof translation === "string") translation = new Translation(translation);
		this.altGenerator = translation instanceof Translation ? translation.get : translation;
		this.refreshText();
		return this;
	}

	@Bound @Override public refreshText () {
		super.refreshText();
		const text = this.altGenerator ? this.altGenerator() as any : "";
		this.attributes.set("alt", text === null || text === undefined ? "" : `${text}`);
		return this;
	}
}
