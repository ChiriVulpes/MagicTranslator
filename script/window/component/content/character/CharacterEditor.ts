import Component from "component/Component";
import Character from "component/content/character/Character";
import Button from "component/shared/Button";
import Interrupt from "component/shared/Interrupt";
import SortableTiles from "component/shared/SortableTiles";
import type Characters from "data/Characters";
import type { CharacterData } from "data/Characters";
import { BasicCharacter } from "data/Characters";
import Projects from "data/Projects";
import Options from "Options";
import Enums from "util/Enums";
import type { Events, IEventEmitter } from "util/EventEmitter";
import FileSystem from "util/FileSystem";
import { pad } from "util/string/String";
import Translation from "util/string/Translation";

interface CharacterEditorEvents extends Events<Component> {
	choose (choice: number | BasicCharacter): any;
}

export default class CharacterEditor extends Component {

	public static async chooseCharacter (startingCharacter?: number | BasicCharacter) {
		const editor = await this.initializeEditor();
		editor.showChoosing();

		if (startingCharacter !== undefined) editor.select(editor.startingCharacter = startingCharacter);

		return new Promise<number | BasicCharacter>(resolve => {
			void editor.event.waitFor("choose")
				.then(([choice]) => {
					editor.hide();
					resolve(choice);
				});
		});
	}

	public static async createCharacter (path?: string, name?: string) {
		if (!path) {
			path = await Options.chooseFile("prompt-character-headshot", result => /\.(png|jpe?g|bmp|gif)/.test(result) && FileSystem.exists(result), undefined, name);
			if (!path) return;
		}

		if (!await FileSystem.exists(path)) {
			console.warn(`Could not create a character, headshot path ${path} is invalid`);
			return;
		}

		const characterEditor = await this.initializeEditor();
		const character = await characterEditor.createCharacter(path, name);
		characterEditor.showViewing(character);

		return Projects.current!.characters.get(character);
	}

	private static async initializeEditor () {
		const editor = Component.get<CharacterEditor>("#character-editor");

		editor.characters = Projects.current!.characters;

		await editor.characters.load();

		editor.characterWrapper.dump();
		editor.characters.characters.stream()
			.filter<undefined>(character => character)
			.merge(Enums.values(BasicCharacter))
			.forEach(editor.addCharacter);

		editor.select(BasicCharacter.Unknown);

		return editor;
	}

	declare event: IEventEmitter<this, CharacterEditorEvents>;

	private readonly removeSelectedCharacterButton: Component;
	private readonly characterWrapper: SortableTiles<Character>;
	private readonly actionRow: Component;
	private startingCharacter: number | BasicCharacter = BasicCharacter.Unknown;
	private characters: Characters;

	public constructor () {
		super();
		this.setId("character-editor");
		this.classes.add("interrupt");

		const content = new Component().appendTo(this);

		this.characterWrapper = new SortableTiles<Character>()
			.classes.add("character-wrapper")
			.event.subscribe("sort", this.updateJson)
			.appendTo(content);

		this.actionRow = new Component()
			.classes.add("character-editor-action-row")
			.appendTo(content);

		new Button()
			.setIcon("\uE109")
			.classes.add("permanent")
			.setText("character-new")
			.event.subscribe("click", () => CharacterEditor.createCharacter())
			.appendTo(this.actionRow);

		this.removeSelectedCharacterButton = new Button()
			.setIcon("\uE107")
			.classes.add("permanent", "warning")
			.setText("remove-selected-character")
			.event.subscribe("click", this.removeSelectedCharacter)
			.appendTo(this.actionRow);

		this.event.subscribe("show", () =>
			Component.window.listeners.until(this.event.waitFor("hide"))
				.add("keyup", this.keyup, true));
	}

	public async createCharacter (file: string, name = "") {
		const img = new Image();
		img.src = file; // `data:image/${path.extname(file)};base64,${new Buffer(await fs.readFile(file)).toString("base64")}`;
		await new Promise(resolve => img.onload = resolve);

		const canvas = document.createElement("canvas");
		canvas.width = img.naturalWidth;
		canvas.height = img.naturalHeight;
		canvas.getContext("2d")!.drawImage(img, 0, 0);

		const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve));

		const buffer = await new Promise<Buffer>(resolve => {
			const reader = new FileReader();
			reader.onload = () => {
				if (reader.readyState === 2) {
					resolve(Buffer.from(reader.result as ArrayBuffer));
				}
			};
			reader.readAsArrayBuffer(blob!);
		});

		const charactersPath = Projects.current!.getPath("character");
		await FileSystem.mkdir(charactersPath);

		const id = this.characters.characterId++;

		await FileSystem.writeFile(`${charactersPath}/${pad(id, 3)}.png`, buffer);

		this.addCharacter({ id, name }).focus();

		this.updateJson();

		return id;
	}

	public override show () {
		super.show();
		this.getSelected().focus();
		return this;
	}

	private showChoosing () {
		this.actionRow.dump(child => !child.classes.has("permanent"))
			.append(new Button()
				.setIcon("\uE106")
				.classes.add("float-left")
				.setText("cancel")
				.event.subscribe("click", this.cancel))
			.append(new Button()
				.setIcon("\uE10B")
				.classes.add("float-right")
				.setText("choose")
				.event.subscribe("click", this.choose));

		return this.show();
	}

	private showViewing (characterId?: number) {
		this.actionRow.dump(child => !child.classes.has("permanent"))
			.append(new Button()
				.setIcon("\uE10B")
				.classes.add("float-right")
				.setText("done")
				.event.subscribe("click", () => this.hide()));

		this.show();

		if (characterId !== undefined) {
			const showButton = this.characterWrapper.tiles()
				.first(button => typeof button.character === "object" && button.character.id === characterId)!;

			if (showButton) showButton.focus();
		}

		return this;
	}

	@Bound private addCharacter (character: CharacterData | BasicCharacter) {
		const characterButton = new Character(character, typeof character === "object")
			.event.subscribe("click", this.select)
			.event.subscribe("shouldRemove", this.removeSelectedCharacter)
			.event.subscribe(["change", "blur", "focus"], event => {
				this.select(event, false);
				this.updateJson();
			});

		this.characterWrapper.addTile(characterButton, typeof character !== "string");

		// put the basic characters beneath the new character button
		this.characterWrapper.tiles()
			.filter(button => typeof button.character === "string")
			.forEach(button => button.parent!.appendTo(this.characterWrapper));

		return characterButton;
	}

	@Bound private async removeSelectedCharacter () {
		const selected = this.getSelected();
		if (typeof selected.character !== "object") return;

		const confirm = await Interrupt.remove(interrupt => interrupt
			.setTitle(() => new Translation("confirm-remove-character").get(selected.getName()))
			.setDescription("confirm-remove-character-description"));

		if (!confirm) return;

		selected.parent!.remove();
		this.updateJson();

		await FileSystem.unlink(`${Projects.current!.getPath("character", selected.character.id)}`)
			.catch(() => { });
	}

	@Bound private updateJson () {
		this.characters.characters = this.characterWrapper.tiles()
			.map(button => button.character)
			.filter<BasicCharacter>(character => typeof character === "object")
			.toArray();
	}

	@Bound private choose () {
		const character = this.getSelected().character;
		this.event.emit("choose", typeof character === "object" ? character.id : character);
	}

	private getSelected () {
		return this.characterWrapper.tiles()
			.first(button => button.classes.has("selected"))!;
	}

	@Bound private cancel () {
		this.event.emit("choose", this.startingCharacter);
	}

	private select (characterButton: Character, focus?: boolean): void;
	private select (character: number | BasicCharacter, focus?: boolean): void;
	@Bound private select (characterButton: Character | number | BasicCharacter, focus = true) {

		if (typeof characterButton === "object") {
			if (!characterButton.classes.has("character"))
				characterButton = characterButton.ancestors<Character>(".character").first()!;

		} else {
			characterButton = this.characterWrapper.tiles()
				.first(button => typeof characterButton === "string" ?
					button.character === characterButton :
					typeof button.character === "object" && button.character.id === characterButton)!;
		}

		if (!characterButton) {
			console.warn("Tried to select an invalid character", characterButton);
			return;
		}

		if (characterButton.classes.has("selected")) return;

		if (focus) characterButton.focus();

		this.characterWrapper.descendants(".selected")
			.forEach(sibling => sibling.classes.remove("selected"));
		characterButton.classes.add("selected");

		this.removeSelectedCharacterButton.setDisabled(typeof characterButton.character === "string");
	}

	@Bound private keyup (event: KeyboardEvent) {
		if (Component.all(".interrupt:not(#character-editor):not(.hidden)").first()) return;

		if (event.code === "Enter") this.choose();
		if (event.code === "Escape") this.cancel();

		if (event.code === "Delete" && event.ctrlKey && typeof this.getSelected() !== "string") {
			void this.removeSelectedCharacter();
		}
	}

}
