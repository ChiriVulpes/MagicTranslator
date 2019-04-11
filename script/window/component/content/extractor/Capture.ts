import Component from "component/Component";
import CharacterEditor from "component/content/character/CharacterEditor";
import Note from "component/content/extractor/Note";
import Dropdown from "component/shared/Dropdown";
import Img from "component/shared/Img";
import SortableList, { SortableListEvent, SortableListItem } from "component/shared/SortableList";
import Textarea from "component/shared/Textarea";
import { CaptureData } from "data/Captures";
import { BasicCharacter } from "data/Characters";
import Projects from "data/Projects";
import { tuple } from "util/Arrays";
import Enums from "util/Enums";
import { pad } from "util/string/String";

export default class Capture extends SortableListItem {

	private readonly img: Img;
	private readonly notes: SortableList;

	public constructor (private readonly captureRoot: string, private readonly capture: CaptureData) {
		super();
		this.classes.add("capture");

		new Component()
			.append(this.img = new Img())
			.appendTo(this);

		this.refreshImage();

		new Component()
			.append(new Textarea()
				.classes.add("japanese")
				.listeners.add(["change", "blur"], this.changeTextarea)
				.setText(() => capture.text)
				.setPlaceholder("source-placeholder"))
			.append(new Textarea()
				.classes.add("translation")
				.setText(() => capture.translation || "")
				.setPlaceholder("translation-placeholder")
				.listeners.add(["change", "blur"], this.changeTextarea))
			.append(this.notes = new SortableList()
				.classes.add("notes")
				.listeners.add(SortableListEvent.SortComplete, () => this.emit("capture-change")))
			.appendTo(this);

		const characters = Projects.current!.characters;

		new Component()
			.classes.add("capture-action-row")
			.append(Dropdown.from(() => [...characters.characters.map(c => c.id), ...Enums.values(BasicCharacter)])
				.classes.add("character-preview-button")
				.style.set("--headshot", typeof capture.character !== "number" ? "" : `url("${Projects.current!.getPath("character", capture.character)}")`)
				.setTranslationHandler(characters.getName)
				.setTitle("character-dropdown")
				.select(characters.getId(capture.character || BasicCharacter.Unknown)!)
				.setOptionInitializer((option, character) => option
					.classes.add("character-preview-button")
					.style.set("--headshot", typeof character !== "number" ? "" : `url("${Projects.current!.getPath("character", character)}")`))
				.listeners.add("select", this.changeCharacter)
				.listeners.add("open", () => this.classes.add("active"))
				.listeners.add("close", () => this.classes.remove("active"))
				.listeners.add("click", this.onCharacterDropdownClick))
			.append(new Component("button")
				.setText("paste-notes")
				.listeners.add("click", this.pasteNotes))
			.append(new Component("button")
				.setText("remove")
				.listeners.add("click", () => this.emit("remove-capture")))
			.appendTo(this);

		(capture.notes && capture.notes.length ? capture.notes : [tuple("", "")])
			.forEach(this.addNote);
	}

	public getData (): CaptureData {
		const notes = this.notes.children<Note>()
			.filter(note => !note.isBlank())
			.map(note => note.getData())
			.toArray();

		return {
			...this.capture,
			notes: notes.length === 0 ? [["", ""]] : notes,
		};
	}

	public refreshImage () {
		this.img.setSrc(`${this.captureRoot}/cap${pad(this.capture.id!, 3)}.png?cachebuster`);
	}

	@Bound private async changeCharacter (event: Event) {
		const dropdown = Component.get<Dropdown<number | BasicCharacter>>(event);
		const character = this.capture.character = dropdown.getSelected();
		dropdown.style.set("--headshot", typeof character !== "number" ? "" : `url("${Projects.current!.getPath("character", character)}")`);
		this.emit("capture-change");
	}

	@Bound private async pasteNotes () {
		const text = await navigator.clipboard.readText();
		for (const [, note, translation] of (/- (.*?):(.*)/g).matches(text)) {
			this.addNote([note.trim(), translation.trim()]);
		}
	}

	@Bound private addNote (noteData?: [string, string]) {
		new Note(noteData)
			.listeners.add("note-change", this.noteChange)
			.listeners.add("note-blur", this.noteBlur)
			.appendTo(this.notes);
	}

	@Bound private noteChange (event: Event) {
		const note = Component.get<Note>(event);

		if (!note.isBlank()) {
			if (note.parent!.child(-1) === note) {
				this.addNote();
			}
		}

		this.emit("capture-change");
	}

	@Bound private noteBlur (event: Event) {
		const note = Component.get<Note>(event);
		const activeComponent = Component.get(document.activeElement!);
		if (activeComponent.isDescendantOf(note)) return;

		if (note.isBlank()) {
			if (note.parent!.child(-1) !== note) {
				note.remove();
			}
		}
	}

	@Bound private changeTextarea (event: Event) {
		const textarea = Component.get<Textarea>(event);
		this.capture[textarea.classes.has("japanese") ? "text" : "translation"] = textarea.getText();
		this.emit("capture-change");
	}

	@Bound private async onCharacterDropdownClick (event: MouseEvent) {
		if (!event.ctrlKey) return;
		this.capture.character = await CharacterEditor.chooseCharacter();
	}
}
