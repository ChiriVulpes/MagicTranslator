import Component from "component/Component";
import CharacterEditor from "component/content/character/CharacterEditor";
import Explorer from "component/content/Explorer";
import Extractor from "component/content/Extractor";
import Volumes from "component/content/Volumes";
import Bound from "util/Bound";
import { tuple } from "util/IterableIterator";
import { ComponentEvent } from "util/Manipulator";
import Options from "util/Options";
import Language from "util/string/Language";

export default class Content extends Component {
	public constructor() {
		super();
		this.setId("content");

		this.initialize();
	}

	public async initialize () {
		await Language.waitForLanguage();

		await Promise.all([
			Options.waitForOptions(),
			new CharacterEditor().hide().appendTo(this).waitForCharacters(),
			Volumes.load(),
		]);

		Component.window.listeners.until(this.listeners.waitFor("remove"))
			.add("keyup", this.keyup, true);

		this.showExplorer();
	}

	private showExplorer (startLocation?: [number, number]) {
		this.children(1).forEach(child => child.remove());

		new Explorer(startLocation)
			.listeners.add("extract", this.extractPage)
			.appendTo(this);
	}

	@Bound
	private extractPage ({ data }: ComponentEvent<[number, number, number, boolean, boolean]>) {
		this.children(1).forEach(child => child.remove());

		const [volume, chapter, page] = data;
		const pages = Volumes.getByIndex(volume)!.getByIndex(chapter)!;

		new Extractor(...data)
			.listeners.add("quit", () => this.showExplorer(tuple(volume, chapter)))
			.listeners.add("previous", () => this.extractPage({ data: [volume, chapter, page - 1, page > 1, true] } as any))
			.listeners.add("next", () => this.extractPage({ data: [volume, chapter, page + 1, true, page < pages.length - 2] } as any))
			.appendTo(this);
	}

	@Bound
	private keyup (event: KeyboardEvent) {
		if (event.code === "F12") window.send("window-toggle-devtools");
	}

}
