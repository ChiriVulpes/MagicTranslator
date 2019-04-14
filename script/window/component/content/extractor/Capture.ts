import Component from "component/Component";
import CharacterEditor from "component/content/character/CharacterEditor";
import Note from "component/content/extractor/Note";
import Button from "component/shared/Button";
import ButtonBar from "component/shared/ButtonBar";
import Dropdown from "component/shared/Dropdown";
import Img from "component/shared/Img";
import SortableList, { SortableListEvent, SortableListItem } from "component/shared/SortableList";
import Textarea from "component/shared/Textarea";
import { CaptureData } from "data/Captures";
import { BasicCharacter } from "data/Characters";
import Projects from "data/Projects";
import Gloss from "util/api/Gloss";
import { tuple } from "util/Arrays";
import Enums from "util/Enums";
import { pad } from "util/string/String";

export default class Capture extends SortableListItem {

	private readonly img: Img;
	private readonly notes: SortableList;
	private readonly glossNotes: Component;

	public constructor (private readonly captureRoot: string, private readonly capture: CaptureData) {
		super();
		this.classes.add("capture");

		new Component()
			.append(this.img = new Img())
			.appendTo(this);

		this.refreshImage();

		new Component()
			.append(new Component()
				.classes.add("japanese-wrapper")
				.append(new Textarea()
					.classes.add("japanese")
					.listeners.add(["change", "blur"], this.changeTextarea)
					.setText(() => capture.text)
					.setPlaceholder("source-placeholder"))
				.append(new Button()
					.setIcon("\uE164")
					.setText("gloss")
					.listeners.add("click", this.gloss)))
			.append(new Textarea()
				.classes.add("translation")
				.setText(() => capture.translation || "")
				.setPlaceholder("translation-placeholder")
				.listeners.add(["change", "blur"], this.changeTextarea))
			.append(new Component()
				.classes.add("notes-wrapper", "empty")
				.append(new Component("h3").setText("gloss"))
				.append(this.glossNotes = new SortableList()
					.classes.add("notes")
					.listeners.add(SortableListEvent.SortComplete, () => this.emit("capture-change"))))
			.append(new Component()
				.classes.add("notes-wrapper", "empty")
				.append(new Component("h3").setText("notes"))
				.append(this.notes = new SortableList()
					.classes.add("notes")
					.listeners.add(SortableListEvent.SortComplete, () => this.emit("capture-change"))))
			.appendTo(this);

		const characters = Projects.current!.characters;

		new ButtonBar()
			.classes.add("capture-action-row")
			.append(Dropdown.from(() => [...characters.characters.map(c => c.id), ...Enums.values(BasicCharacter)])
				.classes.add("character-preview-button")
				.style.set("--headshot", typeof capture.character !== "number" ? "" : `url("${Projects.current!.getPath("character", capture.character)}")`)
				.setTranslationHandler(characters.getName)
				.select(characters.getId(capture.character !== undefined ? capture.character : BasicCharacter.Unknown))
				.setOptionInitializer((option, character) => option
					.classes.add("character-preview-button")
					.style.set("--headshot", typeof character !== "number" ? "" : `url("${Projects.current!.getPath("character", character)}")`))
				.listeners.add("select", this.changeCharacter)
				.listeners.add("open", () => this.classes.add("active"))
				.listeners.add("close", () => this.classes.remove("active"))
				.listeners.add("click", this.onCharacterDropdownClick))
			.append(new Button()
				.setIcon("\uE16D")
				.setText("paste-notes")
				.listeners.add("click", async () => this.insertNotes("normal", await navigator.clipboard.readText())))
			.append(new Button()
				.setIcon("\uE107")
				.classes.add("warning")
				.setText("remove")
				.listeners.add("click", () => this.emit("remove-capture")))
			.appendTo(this);

		(capture.glossNotes && capture.glossNotes.length ? capture.glossNotes : [tuple("", "")])
			.forEach(this.addNote.bind(this, "gloss"));

		(capture.notes && capture.notes.length ? capture.notes : [tuple("", "")])
			.forEach(this.addNote.bind(this, "normal"));
	}

	public getData (): CaptureData {
		const notes = this.notes.children<Note>()
			.filter(note => !note.isBlank())
			.map(note => note.getData())
			.toArray();
		const glossNotes = this.glossNotes.children<Note>()
			.filter(note => !note.isBlank())
			.map(note => note.getData())
			.toArray();

		return {
			...this.capture,
			notes,
			glossNotes,
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

	@Bound private async gloss () {
		this.glossNotes.dump();

		this.glossNotes.classes.add("loading");

		const words = await Gloss.gloss(this.capture.text);

		this.glossNotes.classes.remove("loading");

		if (!words.hasNext()) this.addNote("gloss", ["", ""]);

		for (let { text, gloss } of words) {
			gloss = gloss.trim().replace(/^- (.*?)$/, "$1");
			this.addNote("gloss", [text, gloss]);
		}

		this.emit("capture-change");
	}

	@Bound private async insertNotes (type: "normal" | "gloss", text: string) {
		for (const [, note, translation] of (/- (.*?):((?:.|\r|\n)*)(?!\n- )/g).matches(text)) {
			this.addNote(type, [note.trim(), translation.trim()]);
		}

		this.emit("capture-change");
	}

	@Bound private addNote (type: "normal" | "gloss", noteData?: [string, string]) {
		const parent = type === "normal" ? this.notes : this.glossNotes;

		const note = new Note(noteData)
			.listeners.add("note-change", this.noteChange)
			.listeners.add("note-blur", this.noteBlur)
			.appendTo(parent);

		if (!note.isBlank()) parent.parent!.classes.remove("empty");
	}

	@Bound private noteChange (event: Event) {
		const note = Component.get<Note>(event);

		if (!note.isBlank()) {
			if (note.parent!.child(-1) === note) {
				this.addNote(note.parent === this.notes ? "normal" : "gloss");
			}
		}

		this.emit("capture-change");
	}

	@Bound private async noteBlur (event: Event) {
		const activeComponent = Component.get(document.activeElement!);

		this.notes.children<Note>()
			.merge(this.glossNotes.children<Note>())
			.filter(note => note.isBlank() &&
				!activeComponent.isDescendantOf(note.parent!) &&
				(note.parent!.child(-1) !== note || note.parent!.childCount > 1))
			.collectStream()
			.forEach(note => note.remove());

		for (const noteList of [this.notes, this.glossNotes]) {
			if (noteList.childCount <= 1 && noteList.child<Note>(0)!.isBlank()) {
				noteList.parent!.classes.add("empty");
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
		this.capture.character = await CharacterEditor.chooseCharacter(this.capture.character);
	}
}
