import Component from "component/Component";
import Character, { BasicCharacter, CharacterData } from "component/content/character/Character";
import Bound from "util/Bound";
import Collectors from "util/Collectors";
import Enums from "util/Enums";
import { pipe } from "util/IterableIterator";
import { ComponentEvent } from "util/Manipulator";
import Options from "util/Options";
import { pad } from "util/string/String";
import Translation from "util/string/Translation";

export default class CharacterEditor extends Component {

	public static getCharacter (id: number) {
		return Component.get<CharacterEditor>("#character-editor")
			.characterWrapper
			.children<Character>()
			.map(button => button.character)
			.filter(character => typeof character === "object" && character.id === id)
			.first()!;
	}

	public static getName (character: number | BasicCharacter | CharacterData) {
		if (typeof character === "number") character = CharacterEditor.getCharacter(character);
		return typeof character === "object" ? character.name : new Translation(`character-${character.toLowerCase()}`).get();
	}

	public static async chooseCharacter (startingCharacter?: number | BasicCharacter) {
		const characterEditor = Component.get<CharacterEditor>("#character-editor").show();
		if (startingCharacter !== undefined) characterEditor.select(characterEditor.startingCharacter = startingCharacter);

		return new Promise<number | BasicCharacter>(resolve => {
			characterEditor.listeners.until("choose")
				.add<ComponentEvent<number | BasicCharacter>>("choose", event => {
					characterEditor.hide();
					resolve(event.data);
				});
		});
	}

	private characterId = 0;

	private readonly characterWrapper: Component;
	private startingCharacter: number | BasicCharacter = BasicCharacter.Unknown;

	public constructor() {
		super();
		this.setId("character-editor");

		const content = new Component().appendTo(this);

		this.characterWrapper = new Component()
			.classes.add("character-wrapper")
			.appendTo(content);

		new Component("button")
			.classes.add("character-new")
			.setText("character-new")
			.listeners.add("click", this.newCharacter)
			.appendTo(content);

		new Component("button")
			.setText("cancel")
			.listeners.add("click", this.cancel)
			.appendTo(content);

		new Component("button")
			.setText("choose")
			.listeners.add("click", this.choose)
			.appendTo(content);

		this.listeners.add("show", () =>
			Component.window.listeners.until(this.listeners.waitFor("hide"))
				.add("keyup", this.keyup, true));
	}

	public async waitForCharacters () {
		const jsonData = await fs.readFile(`${options.root}/characters.json`, "utf8")
			.catch(() => { });

		const characterData = JSON.parse(jsonData || "{}") as { characterId?: number; characters?: CharacterData[] };
		this.characterId = characterData.characterId || 0;

		pipe(characterData.characters)
			.flat()
			.filter<undefined>(character => character)
			.include(Enums.values(BasicCharacter))
			.forEach(this.addCharacter);

		this.select(BasicCharacter.Unknown);
	}

	@Bound
	private async newCharacter () {
		const file = await Options.chooseFile("prompt-character-headshot", result => /\.(png|jpg|jpeg)/.test(result) && fs.exists(result));
		if (!file) return;

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

		await fs.mkdir(`${options.root}/character`);

		await fs.writeFile(`${options.root}/character/${pad(this.characterId, 3)}.png`, buffer);

		this.addCharacter({
			id: this.characterId++,
			name: "",
		}).focusInput();

		this.updateJson();
	}

	@Bound
	private addCharacter (character: CharacterData | BasicCharacter) {
		return new Character(character, typeof character === "object")
			.listeners.add("click", this.select)
			.listeners.add("change-name", event => {
				this.select(event, false);
				this.updateJson();
			})
			.appendTo(this.characterWrapper);
	}

	@Bound
	private async updateJson () {
		await fs.writeFile(`${options.root}/characters.json`, JSON.stringify({
			characterId: this.characterId,
			characters: this.characterWrapper.children<Character>()
				.map(button => button.character)
				.filter<BasicCharacter>(character => typeof character === "object")
				.collect(Collectors.toArray),
		}));
	}

	@Bound
	private choose () {
		this.emit("choose", chooseEvent => {
			const character = this.characterWrapper.children<Character>()
				.filter(button => button.classes.has("selected"))
				.first()!
				.character;

			chooseEvent.data = typeof character === "object" ? character.id : character;
		});
	}

	@Bound
	private cancel () {
		this.emit("choose", event => event.data = this.startingCharacter);
	}

	private select (event: Event, focus?: boolean): void;
	private select (character: number | BasicCharacter, focus?: boolean): void;
	@Bound
	private select (eventOrCharacter: Event | number | BasicCharacter, focus = true) {
		let characterButton: Character;

		if (typeof eventOrCharacter === "object") {
			characterButton = Component.get(eventOrCharacter);

		} else {
			characterButton = this.characterWrapper.children<Character>()
				.filter(button => typeof eventOrCharacter === "string" ?
					button.character === eventOrCharacter :
					typeof button.character === "object" && button.character.id === eventOrCharacter)
				.first()!;
		}

		if (characterButton.classes.has("selected")) return;

		if (focus) characterButton.focus();

		characterButton.classes.add("selected")
			.siblings()
			.forEach(sibling => sibling.classes.remove("selected"));
	}

	@Bound
	private keyup (event: KeyboardEvent) {
		if (event.code === "Enter") this.choose();
		if (event.code === "Escape") this.cancel();
	}

}
