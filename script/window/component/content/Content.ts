import Component from "component/Component";
import CharacterEditor from "component/content/character/CharacterEditor";
import Explorer from "component/content/Explorer";
import Extractor from "component/content/Extractor";
import Interrupt from "component/shared/Interrupt";
import Projects from "data/Projects";
import Options from "Options";
import { tuple } from "util/Arrays";
import { ComponentEvent } from "util/Manipulator";
import Language from "util/string/Language";

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

		Component.window.listeners.until(this.listeners.waitFor("remove"))
			.add("keyup", this.keyup, true);

		this.showExplorer();
	}

	public showExplorer (startLocation?: [number, number]) {
		this.children().drop(2).collectStream().forEach(child => child.remove());

		new Explorer(startLocation)
			.listeners.add("extract", this.onExtractPage)
			.appendTo(this);
	}

	public async extractPage (volume: number, chapter: number, page: number) {
		const pages = Projects.current!.volumes.getByIndex(volume)!.getByIndex(chapter)!;
		return this.onExtractPage({ data: [volume, chapter, page, page > 0, page < pages.length - 1] } as any);
	}

	private async onExtractPage (data: { data: [number, number, number] }): Promise<Extractor>;
	private async onExtractPage (event: ComponentEvent<[number, number, number]>): Promise<Extractor>;
	@Bound private async onExtractPage ({ data }: { data: [number, number, number] }): Promise<Extractor> {
		this.children().drop(2).collectStream().forEach(child => child.remove());

		const [volume, chapter, page] = data;
		const pages = Projects.current!.volumes.getByIndex(volume)!.getByIndex(chapter)!;

		const extractPrevious = this.onExtractPrevious(volume, chapter, page);
		const extractNext = this.onExtractNext(volume, chapter, page);

		const extractor = new Extractor(...data)
			.listeners.add("quit", () => this.showExplorer(tuple(volume, chapter)))
			.listeners.add("previous", extractPrevious)
			.listeners.add("next", extractNext)
			.appendTo(this);

		Component.window.listeners.until(extractor.listeners.waitFor("remove"))
			.add<MouseEvent>("mouseup", event => {
				if (event.button === 3 && page - 1 >= 0) extractPrevious();
				if (event.button === 4 && page + 1 < pages.length) extractNext();
			});

		return extractor.initialize();
	}

	private onExtractPrevious (volume: number, chapter: number, page: number) {
		return () => {
			const volumes = Projects.current!.volumes;
			if (page > 0) return this.onExtractPage({ data: [volume, chapter, page - 1] });
			if (chapter > 0) return this.onExtractPage({ data: [volume, chapter - 1, volumes.getByIndex(volume)!.getByIndex(chapter - 1)!.length - 1] });
			if (volume > 0) return this.onExtractPage({
				data: [
					volume - 1,
					volumes.getByIndex(volume - 1)!.size - 1,
					volumes.getByIndex(volume - 1)!.getByIndex(volumes.getByIndex(volume - 1)!.size - 1)!.length - 1
				],
			});
			throw new Error("No previous page to extract.");
		};
	}

	private onExtractNext (volume: number, chapter: number, page: number) {
		return () => {
			const volumes = Projects.current!.volumes;
			if (page < volumes.getByIndex(volume)!.getByIndex(chapter)!.length - 1) return this.onExtractPage({ data: [volume, chapter, page + 1] });
			if (chapter < volumes.getByIndex(volume)!.size - 1) return this.onExtractPage({ data: [volume, chapter + 1, 0] });
			if (volume < volumes.size - 1) return this.onExtractPage({ data: [volume + 1, 0, 0] });
			throw new Error("No next page to extract.");
		};
	}

	@Bound private keyup (event: KeyboardEvent) {
		if (event.code === "F12") window.send("window-toggle-devtools");
		if (event.code === "F11") window.send("window-toggle-fullscreen");
	}

}
