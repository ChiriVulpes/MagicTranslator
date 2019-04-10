import Component from "component/Component";
import Character from "component/content/character/Character";
import Interrupt from "component/shared/Interrupt";
import SortableTiles from "component/shared/SortableTiles";
import Characters, { BasicCharacter, CharacterData } from "data/Characters";
import Projects from "data/Projects";
import Options from "Options";
import Enums from "util/Enums";
import FileSystem from "util/FileSystem";
import { ComponentEvent } from "util/Manipulator";
import { pad } from "util/string/String";
import Translation from "util/string/Translation";

export default class CharacterEditor extends Component {

	public static async chooseCharacter (startingCharacter?: number | BasicCharacter) {
		const editor = await this.initializeEditor();
		editor.showChoosing();

		if (startingCharacter !== undefined) editor.select(editor.startingCharacter = startingCharacter);

		return new Promise<number | BasicCharacter>(resolve => {
			editor.listeners.until("choose")
				.add<ComponentEvent<number | BasicCharacter>>("choose", event => {
					editor.hide();
					resolve(event.data);
				});
		});
	}

	public static async createCharacter (path?: string, name?: string) {
		if (!path) {
			path = await Options.chooseFile("prompt-character-headshot", result => /\.(png|jpg|jpeg)/.test(result) && FileSystem.exists(result), undefined, name);
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
			.listeners.add("sort", this.updateJson)
			.appendTo(content);

		this.actionRow = new Component()
			.classes.add("character-editor-action-row")
			.appendTo(content);

		new Component("button")
			.classes.add("permanent")
			.setText("character-new")
			.listeners.add("click", () => CharacterEditor.createCharacter())
			.appendTo(this.actionRow);

		new Component("button")
			.classes.add("permanent", "warning")
			.setText("remove-selected-character")
			.listeners.add("click", this.removeSelectedCharacter)
			.appendTo(this.actionRow);

		this.listeners.add("show", () =>
			Component.window.listeners.until(this.listeners.waitFor("hide"))
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
			reader.onload = async () => {
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

		this.addCharacter({ id, name }).focusInput();

		this.updateJson();

		return id;
	}

	private showChoosing () {
		this.actionRow.dump(child => !child.classes.has("permanent"))
			.append(new Component("button")
				.classes.add("float-left")
				.setText("cancel")
				.listeners.add("click", this.cancel))
			.append(new Component("button")
				.classes.add("float-right")
				.setText("choose")
				.listeners.add("click", this.choose));

		return this.show();
	}

	private showViewing (characterId?: number) {
		this.actionRow.dump(child => !child.classes.has("permanent"))
			.append(new Component("button")
				.classes.add("float-right")
				.setText("done")
				.listeners.add("click", () => this.hide()));

		this.show();

		if (characterId !== undefined) {
			const showButton = this.characterWrapper.tiles()
				.first(button => typeof button.character === "object" && button.character.id === characterId)!;

			if (showButton) showButton.focusInput();
		}

		return this;
	}

	@Bound private addCharacter (character: CharacterData | BasicCharacter) {
		const characterButton = new Character(character, typeof character === "object")
			.listeners.add("click", this.select)
			.listeners.add(["change-name", "blur"], event => {
				this.select(event, false);
				this.updateJson();
			});

		this.characterWrapper.addTile(characterButton);

		// put the basic characters beneath the new character button
		this.characterWrapper.tiles()
			.filter(button => typeof button.character === "string")
			.forEach(button => button.parent!.appendTo(this.characterWrapper));

		return characterButton;
	}

	@Bound private async removeSelectedCharacter () {
		const selected = this.getSelected();
		if (typeof selected.character !== "object") return;

		const confirm = await Interrupt.confirm(interrupt => interrupt
			.setTitle(() => new Translation("confirm-remove-character").get(selected.getName()))
			.setDescription("confirm-remove-character-description"));

		if (!confirm) return;

		selected.parent!.remove();
		this.updateJson();

		await FileSystem.unlink(`${Projects.current!.getPath("character", selected.character.id)}`)
			.catch(() => { });
	}

	@Bound private async updateJson () {
		this.characters.characters = this.characterWrapper.tiles()
			.map(button => button.character)
			.filter<BasicCharacter>(character => typeof character === "object")
			.toArray();
	}

	@Bound private choose () {
		this.emit("choose", chooseEvent => {
			const character = this.getSelected().character;
			chooseEvent.data = typeof character === "object" ? character.id : character;
		});
	}

	private getSelected () {
		return this.characterWrapper.tiles()
			.first(button => button.classes.has("selected"))!;
	}

	@Bound private cancel () {
		this.emit("choose", event => event.data = this.startingCharacter);
	}

	private select (event: Event, focus?: boolean): void;
	private select (character: number | BasicCharacter, focus?: boolean): void;
	@Bound private select (eventOrCharacter: Event | number | BasicCharacter, focus = true) {
		let characterButton: Character;

		if (typeof eventOrCharacter === "object") {
			characterButton = Component.get(eventOrCharacter);
			if (!characterButton.classes.has("character"))
				characterButton = characterButton.ancestors<Character>(".character").first()!;

		} else {
			characterButton = this.characterWrapper.tiles()
				.first(button => typeof eventOrCharacter === "string" ?
					button.character === eventOrCharacter :
					typeof button.character === "object" && button.character.id === eventOrCharacter)!;
		}

		if (!characterButton) {
			console.warn("Tried to select an invalid character", eventOrCharacter);
			return;
		}

		if (characterButton.classes.has("selected")) return;

		if (focus) characterButton.focus();

		this.characterWrapper.descendants(".selected")
			.forEach(sibling => sibling.classes.remove("selected"));
		characterButton.classes.add("selected");
	}

	@Bound private keyup (event: KeyboardEvent) {
		if (Component.all(".interrupt:not(#character-editor):not(.hidden)").first()) return;

		if (event.code === "Enter") this.choose();
		if (event.code === "Escape") this.cancel();
	}

}
