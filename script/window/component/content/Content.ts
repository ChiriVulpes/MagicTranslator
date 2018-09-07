import Component from "component/Component";
import CharacterEditor from "component/content/character/CharacterEditor";
import Explorer from "component/content/Explorer";
import Extractor from "component/content/Extractor";
import Bound from "util/Bound";
import Collectors from "util/Collectors";
import { tuple } from "util/IterableIterator";
import { ComponentEvent } from "util/Manipulator";
import Options from "util/Options";
import Language from "util/string/Language";

export default class Content extends Component {
	private volumes: Map<string, Map<string, string[]>>;

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
		]);

		this.volumes = await this.getVolumes();

		Component.window.listeners.until(this.listeners.waitFor("remove"))
			.add("keyup", this.keyup, true);

		this.showExplorer();
	}

	private showExplorer (startLocation?: [string, string]) {
		this.children(1).forEach(child => child.remove());

		new Explorer(this.volumes, startLocation)
			.listeners.add("extract", this.extractPage)
			.appendTo(this);
	}

	@Bound
	private extractPage ({ data }: ComponentEvent<[string, string, string, boolean, boolean]>) {
		this.children(1).forEach(child => child.remove());

		const [volume, chapter, page] = data;
		const pages = this.volumes.get(volume)!.get(chapter)!;
		const index = pages.indexOf(page);

		new Extractor(...data)
			.listeners.add("quit", () => this.showExplorer(tuple(volume, chapter)))
			.listeners.add("previous", () => this.extractPage({ data: [volume, chapter, pages[index - 1], index > 1, true] } as any))
			.listeners.add("next", () => this.extractPage({ data: [volume, chapter, pages[index + 1], true, index < pages.length - 2] } as any))
			.appendTo(this);
	}

	@Bound
	private keyup (event: KeyboardEvent) {
		if (event.code === "F12") window.send("window-toggle-devtools");
	}

	////////////////////////////////////
	// Loading the map of Volumes/Chapters/Pages
	//

	private async getVolumes () {
		return (await fs.readdir(options.root))
			.sort()
			.values()
			.filter(volume => /vol\d\d/.test(volume))
			.map(async volume => tuple(volume, await this.getChapters(volume)))
			.awaitAll()
			.collect(Map.createAsync);
	}

	private async getChapters (volume: string) {
		return (await fs.readdir(`${options.root}/${volume}`))
			.sort()
			.values()
			.filter(chapter => /ch\d\d\d/.test(chapter))
			.map(async chapter => tuple(chapter, await this.getPages(volume, chapter)))
			.awaitAll()
			.collect(Map.createAsync);
	}

	private async getPages (volume: string, chapter: string) {
		return (await fs.readdir(`${options.root}/${volume}/${chapter}/raw`))
			.sort()
			.values()
			.filter(page => /\d\d\d\.png/.test(page))
			.collect(Collectors.toArray);
	}
}
