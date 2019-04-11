import Component from "component/Component";
import Input from "component/shared/Input";
import { BasicCharacter, CharacterData } from "data/Characters";
import Projects from "data/Projects";
import Translation from "util/string/Translation";

export default class Character extends Component {

	private name?: Component;

	private _character: CharacterData | BasicCharacter;
	public get character () { return this._character; }

	public constructor (character: number | BasicCharacter | CharacterData = BasicCharacter.Unknown, private editable = false) {
		super(typeof character === "string" ? "button" : undefined);
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
				.append(this.name = new Input()
					.setPlaceholder("name")
					.setText(this.getName)
					.listeners.add("keydown", this.onNameInputKeydown)
					.listeners.add("focus", () => this.emit("focus"))
					.listeners.add("change", this.changeName));

		} else {
			this.setText(this.getName);
		}
	}

	@Override public focus () {
		if (this.name) this.name.focus();
		else super.focus();
		return this;
	}

	@Bound public getName () {
		return !this._character ? "" : typeof this._character === "object" ? this._character.name : new Translation(`character-${this._character.toLowerCase()}`).get();
	}

	@Bound private onNameInputKeydown (event: KeyboardEvent): false | void {
		if (event.code === "Delete" && event.ctrlKey) {
			this.emit("should-remove");
			event.stopPropagation();
			event.preventDefault();
			return false;
		}
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
