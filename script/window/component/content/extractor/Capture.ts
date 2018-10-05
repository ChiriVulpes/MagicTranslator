import Component from "component/Component";
import Character from "component/content/character/Character";
import CharacterEditor from "component/content/character/CharacterEditor";
import Note from "component/content/extractor/Note";
import SortableList, { SortableListEvent, SortableListItem } from "component/shared/SortableList";
import { CaptureData } from "data/Captures";
import Bound from "util/Bound";
import Collectors from "util/Collectors";
import { tuple } from "util/IterableIterator";
import { pad } from "util/string/String";
import Translation from "util/string/Translation";

export default class Capture extends SortableListItem {

	private readonly notes: SortableList;

	public constructor(root: string, private readonly capture: CaptureData) {
		super();
		this.classes.add("capture");

		new Component()
			.append(new Component("img")
				.attributes.set("src", `${root}/cap${pad(capture.id, 3)}.png`))
			.appendTo(this);

		new Component()
			.append(new Component("textarea")
				.classes.add("japanese")
				.attributes.set("rows", "1")
				.attributes.set("placeholder", new Translation("source-placeholder").get())
				.setText(() => capture.text)
				.listeners.add(["change", "keyup", "paste", "input"], this.changeTextarea)
				.listeners.add("blur", this.blurTextarea)
				.listeners.add("contextmenu", this.copy)
				.schedule(this.updateTextareaHeight))
			.append(new Component("textarea")
				.classes.add("translation")
				.attributes.set("rows", "1")
				.attributes.set("placeholder", new Translation("translation-placeholder").get())
				.setText(() => capture.translation || "")
				.listeners.add(["change", "keyup", "paste", "input"], this.changeTextarea)
				.listeners.add("blur", this.blurTextarea)
				.listeners.add("contextmenu", this.copy)
				.schedule(this.updateTextareaHeight))
			.append(this.notes = new SortableList()
				.classes.add("notes")
				.listeners.add(SortableListEvent.SortComplete, () => this.emit("capture-change")))
			.appendTo(this);

		new Component()
			.classes.add("capture-action-row")
			.append(new Character(capture.character)
				.listeners.add("click", this.changeCharacter))
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
			.collect(Collectors.toArray);

		return {
			...this.capture,
			notes: notes.length === 0 ? [["", ""]] : notes,
		};
	}

	@Bound
	private async changeCharacter (event: Event) {
		Component.get<Character>(event).setCharacter(this.capture.character = await CharacterEditor.chooseCharacter(this.capture.character));
		this.emit("capture-change");
	}

	@Bound
	private addNote (noteData?: [string, string]) {
		new Note(noteData)
			.listeners.add("note-change", this.noteChange)
			.listeners.add("note-blur", this.noteBlur)
			.appendTo(this.notes);
	}

	@Bound
	private noteChange (event: Event) {
		const note = Component.get<Note>(event);

		if (!note.isBlank()) {
			if (note.parent!.child(-1) === note) {
				this.addNote();
			}
		}
	}

	@Bound
	private noteBlur (event: Event) {
		const note = Component.get<Note>(event);
		const activeComponent = Component.get(document.activeElement!);
		if (activeComponent.isDescendantOf(note)) return;

		if (note.isBlank()) {
			if (note.parent!.child(-1) !== note) {
				note.remove();
			}
		}
	}

	@Bound
	private changeTextarea (event: Event) {
		const component = Component.get(event);
		this.capture[component.classes.has("japanese") ? "text" : "translation"] = component.element<HTMLTextAreaElement>().value;
		this.updateTextareaHeight(component);
		this.emit("capture-change");
	}

	@Bound
	private blurTextarea (event: Event) {
		const component = Component.get(event);
		const textarea = component.element<HTMLTextAreaElement>();
		this.capture[component.classes.has("japanese") ? "text" : "translation"] = textarea.value = textarea.value.trim();
		this.updateTextareaHeight(component);
		this.emit("capture-change");
	}

	@Bound
	private updateTextareaHeight (textareaComponent: Component) {
		const lines = textareaComponent.element<HTMLTextAreaElement>().value.split("\n").length;
		textareaComponent.style.set("--height", Math.min(2.75862069, lines));
		textareaComponent.classes.toggle(lines > 4, "overflow");
	}

	@Bound
	private copy (event: MouseEvent) {
		const textarea = Component.get(event);
		textarea.element<HTMLTextAreaElement>().select();
		document.execCommand("copy");
	}
}
