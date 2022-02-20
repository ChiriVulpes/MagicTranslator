import Component from "component/Component";
import Textarea from "component/shared/Textarea";
import { sleep } from "util/Async";
import { Events, IEventEmitter } from "util/EventEmitter";

interface NoteEvents extends Events<Component> {
	change (): any;
	blur (): any;
}

export default class Note extends Component {

	declare event: IEventEmitter<this, NoteEvents>;

	protected readonly ja = new Textarea()
		.classes.add("japanese")
		.event.subscribe("change", this.changeTextarea)
		.event.subscribe("blur", this.blurTextarea)
		// .setHandleHeight(false)
		.setText(() => this.noteData[0])
		.setPlaceholder("source-placeholder")
		.appendTo(this);

	protected readonly en = new Textarea()
		.classes.add("translation")
		.event.subscribe("change", this.changeTextarea)
		.event.subscribe("blur", this.blurTextarea)
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

	@Bound private changeTextarea (textarea: Textarea) {
		const ja = textarea.classes.has("japanese");
		this.noteData[ja ? 0 : 1] = textarea.getText();
		// sleep(0.2).then(() => {
		// 	const height = Math.max(this.ja.getHeight(), this.en.getHeight());
		// 	[this.en, this.ja].forEach(t => t.setHeight(height));
		// });
		this.event.emit("change");
	}

	@Bound private blurTextarea (textarea: Textarea) {
		this.noteData[textarea.classes.has("japanese") ? 0 : 1] = textarea.getText();
		sleep(0.01).then(() => this.event.emit("blur"));
		this.classes.toggle(this.isBlank(), "empty");
	}
}
