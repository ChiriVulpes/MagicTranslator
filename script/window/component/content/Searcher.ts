import Component from "component/Component";
import Button from "component/shared/Button";
import ButtonBar from "component/shared/ButtonBar";
import SortableTiles from "component/shared/SortableTiles";
import type { Events, IEventEmitter } from "util/EventEmitter";
import Capture from "./extractor/Capture";
import Projects from "data/Projects";
import IndexedMap from "util/Map";
import { CaptureData } from "data/Captures";
import { tuple } from "util/Arrays";
import LabelledRow from "component/shared/LabelledRow";
import CheckButton from "component/shared/CheckButton";
import Translation from "util/string/Translation";
import Input from "component/shared/Input";

interface SearcherEvents extends Events<Component> {
	quit(): any;
}

export class SearchParams {
	volume?: number;
	chapter?: number;
	page?: number;
	searchInText: boolean;
	searchInTranslation: boolean;
	searchInGlossNotes: boolean;
	searchInNormalNotes: boolean;
	query: string;
}

export default class Searcher extends Component {

	declare event: IEventEmitter<this, SearcherEvents>;

	private readonly actionWrapper = new ButtonBar().appendTo(this);

	private readonly capturesWrapper: SortableTiles<Capture>;

	private readonly searchParams: SearchParams;

	public constructor(private searchLocation: [number?, number?]) {
		super();
		this.setId("searcher");

		new Button()
			.setIcon("\uE096")
			.setText("back")
			.event.subscribe("click", () => this.event.emit("quit"))
			.appendTo(this.actionWrapper);

		this.searchParams = {
			volume: searchLocation[0],
			chapter: searchLocation[1],
			searchInText: true,
			searchInTranslation: true,
			searchInNormalNotes: true,
			searchInGlossNotes: false,
			query: "",
		};

		const searcherWrapper = new Component()
			.classes.add("searcher-wrapper")
			.appendTo(this);

		new Component("section")
			.attributes.set("section", "search")
			.append(new Component("h2")
				.setText("search-title"))
			.append(new LabelledRow("search-query")
				.append(new Input()
					.event.subscribe("change", input => this.searchParams.query = input.getText())))
			.append(new LabelledRow("search-in-text")
				.append(new CheckButton()
					.setChecked(this.searchParams.searchInText)
					.setText(button => new Translation(button.isChecked() ? "enabled" : "disabled").get())
					.event.subscribe("toggle", b => {
						this.searchParams.searchInText = b.isChecked();
						b.refreshText();
					})))
			.append(new LabelledRow("search-in-translation")
				.append(new CheckButton()
					.setChecked(this.searchParams.searchInTranslation)
					.setText(button => new Translation(button.isChecked() ? "enabled" : "disabled").get())
					.event.subscribe("toggle", b => {
						this.searchParams.searchInTranslation = b.isChecked();
						b.refreshText();
					})))
			.append(new LabelledRow("search-in-normal-notes")
				.append(new CheckButton()
					.setChecked(this.searchParams.searchInNormalNotes)
					.setText(button => new Translation(button.isChecked() ? "enabled" : "disabled").get())
					.event.subscribe("toggle", b => {
						this.searchParams.searchInNormalNotes = b.isChecked();
						b.refreshText();
					})))
			.append(new LabelledRow("search-in-gloss-notes")
				.append(new CheckButton()
					.setChecked(this.searchParams.searchInGlossNotes)
					.setText(button => new Translation(button.isChecked() ? "enabled" : "disabled").get())
					.event.subscribe("toggle", b => {
						this.searchParams.searchInGlossNotes = b.isChecked();
						b.refreshText();
					})))
			.append(new Button()
				.setText("search-button")
				.event.subscribe("click", this.issueSearch))
			.appendTo(searcherWrapper);


		this.capturesWrapper = new SortableTiles<Capture>("vertical")
			.classes.add("extraction-captures")
			.appendTo(searcherWrapper);
	}

	@Bound public issueSearch() {
		if(!this.searchParams.query || !this.searchParams.query.trim()) {
			return;
		}

		try {
			this.capturesWrapper.classes.add("loading");

			for (const captureComponent of this.capturesWrapper.tiles()) {
				captureComponent.remove();
			}

			const capturesWithPaths = this.search(this.searchParams);

			for (const captureWithPath of capturesWithPaths) {
				new Capture(this.getCapturePagePath(captureWithPath[1]), captureWithPath[0])
					.schedule(this.capturesWrapper.addTile);
			}
		}
		finally {
			this.capturesWrapper.classes.remove("loading");
		}
	}

	private captureMatches(captureData: CaptureData, searchParams: SearchParams): boolean {
		if (searchParams.searchInText) {
			if (captureData.text.includes(searchParams.query)) {
				return true;
			}
		}

		if (searchParams.searchInTranslation) {
			if (captureData.translation.includes(searchParams.query)) {
				return true;
			}
		}

		if (searchParams.searchInNormalNotes) {
			for (const note of captureData.notes) {
				for (const text of note) {
					if(text.includes(searchParams.query)) {
						return true;
					}
				}
			}
		}

		if (searchParams.searchInGlossNotes) {
			for (const note of captureData.glossNotes ?? []) {
				for (const text of note) {
					if(text.includes(searchParams.query)) {
						return true;
					}
				}
			}
		}

		return false;
	}

	private search(searchParams: SearchParams) {
		const project = Projects.current!;
		const volumes = project.volumes;

		const volumeIndices = searchParams.volume !== undefined ? Stream.of(searchParams.volume) : volumes.indices();

		return volumeIndices.flatMap(volumeIndex => {
			const chapterMap = volumes.getByIndex(volumeIndex)!;
			const chapterIndices = searchParams.chapter !== undefined ? Stream.of(searchParams.chapter) : chapterMap.indices();
			return chapterIndices.flatMap(chapterIndex => {
				const pages = chapterMap.getByIndex(chapterIndex)!;
				return Stream.from(pages).flatMap((page, pageIndex) => {
					return page.captures.captures.map(capture => {
						return tuple(capture, tuple(volumeIndex, chapterIndex, pageIndex))
					}).filter(capture => {
						return this.captureMatches(capture[0], searchParams);
					})
				})
			});
		})
	}

	@Bound private keyup(event: KeyboardEvent) {
		if (event.code === "Escape") this.event.emit("quit");
	}

	private getCapturePagePath(captureLocation: [number, number, number]) {
		return Projects.current!.getPath("capture", captureLocation[0], captureLocation[1], captureLocation[2]);
	}
}