import Component from "component/Component";
import CharacterEditor from "component/content/character/CharacterEditor";
import { SortableListItem } from "component/shared/SortableList";
import { BasicCharacter, CharacterData } from "data/Characters";
import Bound from "util/Bound";
import { pad } from "util/string/String";
import Translation from "util/string/Translation";

export default class Character extends SortableListItem {
	private _character: CharacterData | BasicCharacter;

	public get character () { return this._character; }

	public constructor(character: number | BasicCharacter | CharacterData = BasicCharacter.Unknown, private editable = false) {
		super("button");
		this.classes.add("character");

		new Component().appendTo(this);

		this.setCharacter(character);
	}

	public setCharacter (character: number | CharacterData | BasicCharacter) {
		if (typeof character === "number") character = CharacterEditor.getCharacter(character);
		this._character = character;

		if (typeof this._character === "object") {
			this.style.set("--headshot", `url("${options.root}/character/${pad(this._character.id, 3)}.png")`);
		} else {
			this.style.remove("--headshot");
		}

		if (typeof character !== "string" && this.editable) {
			this.child(0)!
				.dump()
				.append(new Component("textarea")
					.attributes.set("rows", "1")
					.attributes.set("placeholder", new Translation("name").get())
					.setText(this.getCharacterName)
					.listeners.add(["change", "keyup", "paste", "input", "focus"], this.changeName));
		} else {
			this.child(0)!.setText(this.getCharacterName);
		}
	}

	public focusInput () {
		const textarea = this.child(0);
		if (textarea) textarea.focus();
	}

	@Bound
	private getCharacterName () {
		return !this._character ? "" : typeof this._character === "object" ? this._character.name : new Translation(`character-${this._character.toLowerCase()}`).get();
	}

	@Bound
	private changeName (event: Event) {
		const textarea = Component.get(event).element<HTMLTextAreaElement>();
		const value = textarea.value;
		(this._character as CharacterData).name = value.endsWith("\n") ? textarea.value = value.trim() : value;
		this.emit("change-name");
	}
}
