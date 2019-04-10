import Component from "component/Component";
import Interrupt from "component/shared/Interrupt";
import { SortableListItem } from "component/shared/SortableList";
import { BasicCharacter, CharacterData } from "data/Characters";
import Projects from "data/Projects";
import FileSystem from "util/FileSystem";
import Translation from "util/string/Translation";

export default class Character extends SortableListItem {

	private name?: Component;

	private _character: CharacterData | BasicCharacter;
	public get character () { return this._character; }

	public constructor (character: number | BasicCharacter | CharacterData = BasicCharacter.Unknown, private editable = false) {
		super("button");
		this.classes.add("character");

		new Component().appendTo(this);

		this.setCharacter(character);
	}

	public setCharacter (character: number | CharacterData | BasicCharacter): void;
	public setCharacter (character: number | CharacterData | BasicCharacter | undefined) {
		if (typeof character === "number") character = Projects.current!.characters.get(character);
		if (character === undefined) character = BasicCharacter.Unknown;

		this._character = character;

		if (typeof this._character === "object") {
			this.style.set("--headshot", `url("${Projects.current!.getPath("character", this._character.id)}")`);

		} else {
			this.style.remove("--headshot");
		}

		if (typeof character !== "string" && this.editable) {
			this.child(0)!
				.dump()
				.append(this.name = new Component("textarea")
					.attributes.set("rows", "1")
					.attributes.set("placeholder", new Translation("name").get())
					.setText(this.getCharacterName)
					.listeners.add(["change", "keyup", "paste", "input", "focus"], this.changeName))
				.append(new Component()
					.classes.add("character-action-row")
					.append(new Component("button")
						.setText("remove")
						.listeners.add("click", this.removeCharacter)));

		} else {
			this.child(0)!.setText(this.getCharacterName);
		}
	}

	public focusInput () {
		if (this.name) this.name.focus();
	}

	@Bound private getCharacterName () {
		return !this._character ? "" : typeof this._character === "object" ? this._character.name : new Translation(`character-${this._character.toLowerCase()}`).get();
	}

	@Bound private changeName (event: Event) {
		const textarea = Component.get(event).element<HTMLTextAreaElement>();
		const value = textarea.value;
		(this._character as CharacterData).name = value.endsWith("\n") ? textarea.value = value.trim() : value;
		this.emit("change-name");
	}

	@Bound private async removeCharacter () {
		const confirm = await Interrupt.confirm(interrupt => interrupt
			.setTitle(() => new Translation("confirm-remove-character").get(this.getCharacterName()))
			.setDescription("confirm-remove-character-description"));

		if (!confirm) return;

		this.remove();
		this.emit("change-name");

		if (typeof this.character === "object") {
			await FileSystem.unlink(`${Projects.current!.getPath("character", this.character.id)}`)
				.catch(() => { });
		}
	}
}
