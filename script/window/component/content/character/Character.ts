import Component from "component/Component";
import CharacterEditor from "component/content/character/CharacterEditor";
import Bound from "util/Bound";
import { pad } from "util/string/String";
import Translation from "util/string/Translation";

export interface CharacterData {
	id: number;
	name: string;
}

export enum BasicCharacter {
	Sfx = "sfx",
	Narrator = "narrator",
	ChapterTitle = "chapter-title",
	Unknown = "unknown",
}

export default class Character extends Component {
	private _character: CharacterData | BasicCharacter;

	public get character () { return this._character; }

	public constructor(character: number | BasicCharacter | CharacterData = BasicCharacter.Unknown, editable = false) {
		super("button");
		this.classes.add("character");

		this.setCharacter(character);

		if (editable) {
			new Component("textarea")
				.attributes.set("rows", "1")
				.attributes.set("placeholder", new Translation("name").get())
				.setText(this.getCharacterName)
				.listeners.add(["change", "keyup", "paste", "input", "focus"], this.changeName)
				.appendTo(this);
		} else {
			this.setText(this.getCharacterName);
		}
	}

	public setCharacter (character: number | CharacterData | BasicCharacter) {
		if (typeof character === "number") character = CharacterEditor.getCharacter(character);
		this._character = character;

		if (typeof this._character === "object") {
			this.style.set("--headshot", `url("${options.root}/character/${pad(this._character.id, 3)}.png")`);
		} else {
			this.style.remove("--headshot");
		}

		this.refreshText();
	}

	@Bound
	private getCharacterName () {
		return typeof this._character === "object" ? this._character.name : new Translation(`character-${this._character.toLowerCase()}`).get();
	}

	@Bound
	private changeName (event: Event) {
		(this._character as CharacterData).name = Component.get(event).element<HTMLTextAreaElement>().value;
		this.emit("change-name");
	}
}
