import Component from "component/Component";
import CharacterEditor from "component/content/character/CharacterEditor";
import Explorer from "component/content/Explorer";
import Extractor from "component/content/Extractor";
import Header from "component/header/Header";
import Interrupt from "component/shared/Interrupt";
import Projects from "data/Projects";
import Options from "Options";
import { tuple } from "util/Arrays";
import Language from "util/string/Language";
import Translation from "util/string/Translation";

export default class Content extends Component {

	public constructor () {
		super();
		this.setId("content");

		// window.send("window-toggle-devtools");

		this.initialize();
	}

	public async initialize () {
		await Language.waitForLanguage();

		new Interrupt().hide().appendTo(this);

		await Promise.all([
			Options.waitForOptions(),
			new CharacterEditor().hide().appendTo(this),
			Projects.load(),
		]);

		Component.window.listeners.until(this.event.waitFor("remove"))
			.add("keyup", this.keyup, true);

		this.showExplorer();
	}

	public showExplorer (startLocation?: [string, number?, number?]) {
		this.children().drop(2).collectStream().forEach(child => child.remove());

		new Explorer(startLocation)
			.event.subscribe("extract", this.onExtractPage)
			.appendTo(this);
	}

	public async extractPage (volume: number, chapter: number, page: number) {
		return this.onExtractPage(volume, chapter, page);
	}

	private async onExtractPage (volume: number, chapter: number, page: number): Promise<Extractor>;
	private async onExtractPage (explorer: Explorer, volume: number, chapter: number, page: number): Promise<Extractor>;
	@Bound private async onExtractPage (explorer: any, volume: number, chapter: number, page?: number): Promise<Extractor> {
		if (page === undefined) {
			page = chapter;
			chapter = volume;
			volume = explorer;
		}

		this.children().drop(2).collectStream().forEach(child => child.remove());

		const project = Projects.current!;
		const pages = project.volumes.getByIndex(volume)!.getByIndex(chapter)!;

		const extractPrevious = this.onExtractPrevious(volume, chapter, page);
		const extractNext = this.onExtractNext(volume, chapter, page);

		const extractor = new Extractor(volume, chapter, page)
			.event.subscribe("quit", () => this.showExplorer(tuple(project.root, volume, chapter)))
			.event.subscribe("previous", extractPrevious)
			.event.subscribe("next", extractNext)
			.appendTo(this);

		const [volumeNumber, chapterNumber, pageNumber] = project.getSegmentNumbers(volume, chapter, page);

		Header.setBreadcrumbs(
			["title", () => this.showExplorer()],
			[() => new Translation("project").get(project.getDisplayName()), () => this.showExplorer([project.root])],
			[() => new Translation("volume").get(volumeNumber), () => this.showExplorer([project.root, volume])],
			[() => new Translation("chapter").get(chapterNumber), () => this.showExplorer([project.root, volume, chapter])],
			[() => new Translation("page").get(pageNumber)],
		);

		Component.window.listeners.until(extractor.event.waitFor("remove"))
			.add<MouseEvent>("mouseup", event => {
				if (event.button === 3 && page! - 1 >= 0) extractPrevious();
				if (event.button === 4 && page! + 1 < pages.length) extractNext();
			});

		return extractor.initialize();
	}

	private onExtractPrevious (volume: number, chapter: number, page: number) {
		return () => {
			const volumes = Projects.current!.volumes;
			if (page > 0) return this.onExtractPage(volume, chapter, page - 1);
			if (chapter > 0) return this.onExtractPage(volume, chapter - 1, volumes.getByIndex(volume)!.getByIndex(chapter - 1)!.length - 1);
			return this.onExtractPage(volume - 1, volumes.getByIndex(volume - 1)!.size - 1, volumes.getByIndex(volume - 1)!.getByIndex(volumes.getByIndex(volume - 1)!.size - 1)!.length - 1);
		};
	}

	private onExtractNext (volume: number, chapter: number, page: number) {
		return () => {
			const volumes = Projects.current!.volumes;
			if (page < volumes.getByIndex(volume)!.getByIndex(chapter)!.length - 1) return this.onExtractPage(volume, chapter, page + 1);
			if (chapter < volumes.getByIndex(volume)!.size - 1) return this.onExtractPage(volume, chapter + 1, 0);
			return this.onExtractPage(volume + 1, 0, 0);
		};
	}

	@Bound private keyup (event: KeyboardEvent) {
		if (event.code === "F12") window.send("window-toggle-devtools");
		if (event.code === "F11") window.send("window-toggle-fullscreen");
	}

}
