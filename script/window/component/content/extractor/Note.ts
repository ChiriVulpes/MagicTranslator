import Component from "component/Component";
import { SortableListItem } from "component/shared/SortableList";
import Textarea from "component/shared/Textarea";
import { sleep } from "util/Async";
import Bound from "util/Bound";

export default class Note extends SortableListItem {

	private readonly ja = new Textarea()
		.classes.add("japanese")
		.listeners.add("change", this.changeTextarea)
		.listeners.add("blur", this.blurTextarea)
		// .setHandleHeight(false)
		.setText(() => this.noteData[0])
		.setPlaceholder("source-placeholder")
		.appendTo(this);

	private readonly en = new Textarea()
		.classes.add("translation")
		.listeners.add("change", this.changeTextarea)
		.listeners.add("blur", this.blurTextarea)
		// .setHandleHeight(false)
		.setText(() => this.noteData[1])
		.setPlaceholder("note-placeholder")
		.appendTo(this);

	public constructor (private readonly noteData: [string, string] = ["", ""]) {
		super();
		this.classes.add("note");

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
		const textarea = Component.get<Textarea>(event);
		const ja = textarea.classes.has("japanese");
		this.noteData[ja ? 0 : 1] = textarea.getText();
		sleep(0.2).then(() => {
			const height = Math.max(this.ja.getHeight(), this.en.getHeight());
			[this.en, this.ja].forEach(t => t.setHeight(height));
		});
		this.emit("note-change");
	}

	@Bound
	private blurTextarea (event: Event) {
		const textarea = Component.get<Textarea>(event);
		this.noteData[textarea.classes.has("japanese") ? 0 : 1] = textarea.getText();
		sleep(0.01).then(() => this.emit("note-blur"));
		this.classes.toggle(this.isBlank(), "empty");
	}
}
