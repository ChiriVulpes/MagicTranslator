import Component from "component/Component";
import { BasicCharacter, CharacterData } from "data/Characters";
import Projects from "data/Projects";
import Translation from "util/string/Translation";

export default class Character extends Component {

	private name?: Component;

	private _character: CharacterData | BasicCharacter;
	public get character () { return this._character; }

	public constructor (character: number | BasicCharacter | CharacterData = BasicCharacter.Unknown, private editable = false) {
		super();
		this.classes.add("character");

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
			this.dump()
				.append(this.name = new Component("textarea")
					.attributes.set("rows", "1")
					.attributes.set("placeholder", new Translation("name").get())
					.setText(this.getName)
					.listeners.add(["change", "keyup", "paste", "input", "focus"], this.changeName));

		} else {
			this.setText(this.getName);
		}
	}

	public focusInput () {
		if (this.name) this.name.focus();
	}

	@Bound public getName () {
		return !this._character ? "" : typeof this._character === "object" ? this._character.name : new Translation(`character-${this._character.toLowerCase()}`).get();
	}

	@Bound private changeName (event: Event) {
		const textarea = Component.get(event).element<HTMLTextAreaElement>();
		const value = textarea.value.endsWith("\n") ? textarea.value = textarea.value.trim() : textarea.value;
		const characterData = (this._character as CharacterData);
		if (characterData.name !== value) {
			characterData.name = value;
			this.emit("change-name");
		}
	}
}
