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

interface SearcherEvents extends Events<Component> {
	quit (): any;
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

	public constructor (private readonly searchLocation: [number?, number?]) {
		super();
		this.setId("searcher");

        new Button()
			.setIcon("\uE096")
			.setText("back")
			.event.subscribe("click", () => this.event.emit("quit"))
			.appendTo(this.actionWrapper);


        new Button()
			.setText("search")
			.event.subscribe("click", this.issueSearch)
			.appendTo(this.actionWrapper);


        this.capturesWrapper = new SortableTiles<Capture>("vertical")
            .classes.add("extraction-captures")
            .appendTo(this);
    }

    @Bound public issueSearch () {
        try {
			this.capturesWrapper.classes.add("loading");

            for (const captureComponent of this.capturesWrapper.tiles()) {
                captureComponent.remove();
            }
            
            const capturesWithPaths = this.search({
                searchInGlossNotes: false,
                searchInNormalNotes: true,
                searchInText: true,
                searchInTranslation: true,
                query: "Yoruno",
                chapter: this.searchLocation[1],
                volume: this.searchLocation[0],
            });

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
        if(searchParams.searchInText) {
            if(captureData.text.includes(searchParams.query)) {
                return true;
            }
        }

        if(searchParams.searchInTranslation) {
            if(captureData.translation.includes(searchParams.query)) {
                return true;
            }
        }

        if(searchParams.searchInNormalNotes) {
            for (const note of captureData.notes) {
                if(note.includes(searchParams.query)) {
                    return true;
                }
            }
        }

        if(searchParams.searchInGlossNotes) {
            for (const note of captureData.glossNotes ?? []) {
                if(note.includes(searchParams.query)) {
                    return true;
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
                return Stream.from(pages).flatMap(page => {
                    return page.captures.captures.map((capture, captureIndex) => {
                        return tuple(capture, tuple(volumeIndex, chapterIndex, captureIndex))
                    }).filter(capture => {
                        return this.captureMatches(capture[0], searchParams);
                    })
                })
            });
        })
    }

    @Bound private keyup (event: KeyboardEvent) {
		if (event.code === "Escape") this.event.emit("quit");
	}

    private getCapturePagePath (captureLocation: [number, number, number]) {
		return Projects.current!.getPath("capture", captureLocation[0], captureLocation[1], captureLocation[2]);
	}
}