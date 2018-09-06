import Component from "component/Component";
import { SortableListItem } from "component/shared/SortableList";
import { sleep } from "util/Async";
import Bound from "util/Bound";
import Translation from "util/string/Translation";

export default class Note extends SortableListItem {
	public constructor(private readonly noteData: [string, string] = ["", ""]) {
		super();
		this.classes.add("note");

		new Component("textarea")
			.classes.add("japanese")
			.attributes.set("rows", "1")
			.attributes.set("placeholder", new Translation("source-placeholder").get())
			.setText(() => noteData[0])
			.listeners.add(["change", "keyup", "paste", "input", "focus"], this.changeTextarea)
			.listeners.add("blur", this.blurTextarea)
			.listeners.add("contextmenu", this.copy)
			.appendTo(this)
			.schedule(this.updateTextareaHeight);

		new Component("textarea")
			.classes.add("translation")
			.attributes.set("rows", "1")
			.attributes.set("placeholder", new Translation("note-placeholder").get())
			.setText(() => noteData[1])
			.listeners.add(["change", "keyup", "paste", "input", "focus"], this.changeTextarea)
			.listeners.add("blur", this.blurTextarea)
			.listeners.add("contextmenu", this.copy)
			.appendTo(this)
			.schedule(this.updateTextareaHeight);

		this.classes.toggle(this.isBlank(), "empty");
	}

	public getData () {
		return this.noteData;
	}

	public isBlank () {
		return this.noteData[0] === "" && this.noteData[1] === "";
	}

	@Bound
	private changeTextarea (event: Event) {
		const component = Component.get(event);
		this.noteData[component.classes.has("japanese") ? 0 : 1] = component.element<HTMLTextAreaElement>().value;
		this.updateTextareaHeight(component);
		this.emit("note-change");
	}

	@Bound
	private blurTextarea (event: Event) {
		const component = Component.get(event);
		const textarea = component.element<HTMLTextAreaElement>();
		this.noteData[component.classes.has("japanese") ? 0 : 1] = textarea.value = textarea.value.trim();
		this.updateTextareaHeight(component);
		sleep(0.01).then(() => this.emit("note-blur"));
		this.classes.toggle(this.isBlank(), "empty");
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
