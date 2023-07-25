import Component from "component/Component";
import CharacterEditor from "component/content/character/CharacterEditor";
import Note from "component/content/extractor/Note";
import Button from "component/shared/Button";
import ButtonBar from "component/shared/ButtonBar";
import Dropdown from "component/shared/Dropdown";
import Img from "component/shared/Img";
import SortableTiles from "component/shared/SortableTiles";
import Textarea from "component/shared/Textarea";
import type { CaptureData } from "data/Captures";
import { BasicCharacter } from "data/Characters";
import Projects from "data/Projects";
import Gloss from "util/api/Gloss";
import { tuple } from "util/Arrays";
import Enums from "util/Enums";
import type { Events, IEventEmitter } from "util/EventEmitter";
import { pad } from "util/string/String";

interface CaptureEvents extends Events<Component> {
	captureChange (): any;
	removeCapture (activeInput?: "source" | "translation"): any;
}

enum NoteType {
	Gloss = "gloss",
	Normal = "normal",
}

export default class Capture extends Component {

	declare event: IEventEmitter<this, CaptureEvents>;

	private readonly img: Img;
	private readonly characterDropdown: Dropdown<number | BasicCharacter>;
	private readonly notesWrappers = new Map<NoteType, SortableTiles<Note>>();
	private readonly textareaSource: Textarea;
	private readonly textareaTranslation: Textarea;

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
				.append(this.textareaSource = new Textarea()
					.classes.add("japanese")
					.event.subscribe(["change", "blur"], this.changeTextarea)
					.event.subscribe("keydown", this.keydownTextarea)
					.setText(() => capture.text)
					.setPlaceholder("source-placeholder"))
				.append(new Button()
					.setIcon("\uE164")
					.setText("gloss")
					.event.subscribe("click", this.gloss)))
			.append(this.textareaTranslation = new Textarea()
				.classes.add("translation")
				.setText(() => capture.translation || "")
				.setPlaceholder("translation-placeholder")
				.event.subscribe("keydown", this.keydownTextarea)
				.event.subscribe(["change", "blur"], this.changeTextarea))
			.append(Enums.values(NoteType)
				.map(noteType => new Component()
					.classes.add("notes-wrapper", "empty")
					.append(new Component("h3").setText(noteType))
					.append(new SortableTiles<Note>("vertical")
						.classes.add("notes")
						.event.subscribe("sort", () => this.event.emit("captureChange"))
						.schedule(notesWrapper => this.notesWrappers.set(noteType, notesWrapper)))))
			.appendTo(this);

		const characters = Projects.current!.characters;

		new ButtonBar()
			.classes.add("capture-action-row")
			.append(this.characterDropdown = Dropdown.from(() => [...characters.characters.map(c => c.id), ...Enums.values(BasicCharacter)])
				.classes.add("character-preview-button")
				.style.set("--headshot", typeof capture.character !== "number" ? "" : `url("${Projects.current!.getPath("character", capture.character)}")`)
				.setTranslationHandler(characters.getName)
				.select(characters.getId(capture.character !== undefined ? capture.character : BasicCharacter.Unknown))
				.setOptionInitializer((option, character) => option
					.classes.add("character-preview-button")
					.style.set("--headshot", typeof character !== "number" ? "" : `url("${Projects.current!.getPath("character", character)}")`))
				.event.subscribe("select", this.changeCharacter)
				.event.subscribe("open", () => this.classes.add("active"))
				.event.subscribe("close", () => this.classes.remove("active"))
				.listeners.add("click", this.onCharacterDropdownClick))
			.append(new Button()
				.setIcon("\uE16D")
				.setText("paste-notes")
				.event.subscribe("click", async () => this.insertNotes(NoteType.Normal, await navigator.clipboard.readText())))
			.append(new Button()
				.setIcon("\uE107")
				.classes.add("warning")
				.setText("remove")
				.event.subscribe("click", () => this.event.emit("removeCapture")))
			.appendTo(this);

		(capture.glossNotes && capture.glossNotes.length ? capture.glossNotes : [tuple("", "")])
			.forEach(this.addNote.bind(this, NoteType.Gloss));

		(capture.notes && capture.notes.length ? capture.notes : [tuple("", "")])
			.forEach(this.addNote.bind(this, NoteType.Normal));
	}

	public getData (): CaptureData {
		const notes = this.notesWrappers.entries()
			.map(([type, wrapper]) => tuple(type, wrapper.tiles()
				.filter(note => !note.isBlank())
				.map(note => note.getData())
				.toArray()))
			.toObject();

		return {
			...this.capture,
			notes: notes.normal,
			glossNotes: notes.gloss,
		};
	}

	public refreshImage () {
		this.img.setSrc(`${this.captureRoot}/cap${pad(this.capture.id!, 3)}.png?cachebuster${Math.random()}`);
	}

	public override focus (which?: "source" | "translation") {
		(which === "source" ? this.textareaSource : this.textareaTranslation).selectContents();
		return this;
	}

	@Bound private changeCharacter () {
		const character = this.capture.character = this.characterDropdown.getSelected();
		this.characterDropdown.style.set("--headshot", typeof character !== "number" ? "" : `url("${Projects.current!.getPath("character", character)}")`);
		this.event.emit("captureChange");
	}

	@Bound private async gloss () {
		const glossNotes = this.notesWrappers.get(NoteType.Gloss)!;
		glossNotes.dump();

		glossNotes.classes.add("loading");

		const words = await Gloss.gloss(this.capture.text);

		glossNotes.classes.remove("loading");

		if (!words.hasNext()) this.addNote(NoteType.Gloss, ["", ""]);

		for (let { text, gloss } of words) {
			gloss = gloss.trim().replace(/^- (.*?)$/, "$1");
			this.addNote(NoteType.Gloss, [text, gloss]);
		}

		this.event.emit("captureChange");
	}

	@Bound private insertNotes (type: NoteType, text: string) {
		for (const [, note, translation] of (/- (.*?):((?:.|\r|\n)*)(?!\n- )/g).matches(text)) {
			this.addNote(type, [note.trim(), translation.trim()]);
		}

		this.event.emit("captureChange");
	}

	@Bound private addNote (type: NoteType, noteData?: [string, string]) {
		const wrapper = this.notesWrappers.get(type)!;

		const note = new Note(noteData)
			.attributes.set("type", type)
			.event.subscribe("change", this.noteChange)
			.event.subscribe("blur", this.noteBlur)
			.event.subscribe("removeNote", (_, which) => {
				const notes = [...wrapper.tiles()];
				const index = notes.indexOf(note);
				notes.splice(index, 1);
				note.remove();
				(notes[index] ?? notes[index - 1])?.focus(which);
			})
			.schedule(wrapper.addTile);

		if (!note.isBlank()) wrapper.parent!.classes.remove("empty");
	}

	@Bound private noteChange (note: Note) {
		if (!note.isBlank()) {
			this.notesWrappers.values()
				.find(wrapper => wrapper.element().contains(note.element()))
				?.parent!.classes.remove("empty");

			const noteType = note.attributes.get<NoteType>("type");
			if (note.isDescendantOf(this.notesWrappers.get(noteType)!.child(-1)!)) {
				this.addNote(noteType);
			}
		}

		this.event.emit("captureChange");
	}

	@Bound private noteBlur () {
		const activeComponent = Component.get(document.activeElement!);

		this.notesWrappers.values()
			.forEach(wrapper => wrapper.tiles()
				.filter(note => note.isBlank() &&
					!activeComponent.isDescendantOf(wrapper) &&
					(wrapper.child(-1) !== note.parent! || wrapper.childCount > 1))
				.forEach(note => note.remove()));

		for (const noteList of this.notesWrappers.values()) {
			if (noteList.childCount <= 1 && noteList.tiles().first()!.isBlank()) {
				noteList.parent!.classes.add("empty");
			}
		}
	}

	@Bound private changeTextarea (textarea: Textarea) {
		this.capture[textarea.classes.has("japanese") ? "text" : "translation"] = textarea.getText();
		this.event.emit("captureChange");
	}

	@Bound private keydownTextarea (textarea: Textarea, key: string, event: KeyboardEvent) {
		if (key === "Delete" && event.altKey) {
			this.event.emit("removeCapture", textarea === this.textareaTranslation ? "translation" : "source");
		}
	}

	@Bound private async onCharacterDropdownClick (event: MouseEvent) {
		if (!event.ctrlKey) return;
		this.characterDropdown.close();
		this.capture.character = await CharacterEditor.chooseCharacter(this.capture.character);
		const characters = Projects.current!.characters;
		this.characterDropdown.select(characters.getId(this.capture.character !== undefined ? this.capture.character : BasicCharacter.Unknown));
		this.characterDropdown.focus();
	}
}
