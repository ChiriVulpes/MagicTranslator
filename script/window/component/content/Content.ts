import Component from "component/Component";
import Explorer from "component/content/Explorer";
import Bound from "util/Bound";
import { tuple } from "util/IterableIterator";
import { ComponentEvent } from "util/Manipulator";
import Options from "util/Options";
import Language from "util/string/Language";
import Extractor from "./Extractor";

export default class Content extends Component {
	public constructor() {
		super();
		this.setId("content");

		this.initialize();
	}

	public async initialize () {
		await Promise.all([
			Language.waitForLanguage(),
			Options.waitForOptions(),
		]);

		this.showExplorer();
	}

	private showExplorer (startLocation?: [string, string]) {
		this.dump();

		new Explorer(startLocation)
			.listeners.add("extract", this.extractPage)
			.appendTo(this);
	}

	@Bound
	private extractPage ({ data: [volume, chapter, page] }: ComponentEvent<[string, string, string]>) {
		this.dump();

		new Extractor(volume, chapter, page)
			.listeners.add("quit", () => this.showExplorer(tuple(volume, chapter)))
			.appendTo(this);
	}
}
