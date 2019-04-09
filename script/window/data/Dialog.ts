import CharacterEditor from "component/content/character/CharacterEditor";
import Extractor from "component/content/Extractor";
import { BasicCharacter, CharacterData } from "data/Characters";
import Projects from "data/Projects";
import Options from "Options";
import { tuple } from "util/Arrays";
import File from "util/File";
import FileSystem from "util/FileSystem";

export class DialogImpl {
	public async export (root: string, volume: number, chapter: number, page?: number) {
		const project = Projects.get(root)!;
		const [volumeString, chapterString] = project.getPaths(volume, chapter);
		const [volumeNumber, chapterNumber, pageNumber] = project.getNumbers(volume, chapter, page);

		let result = `# Volume ${volumeNumber}, Chapter ${chapterNumber}`;

		if (page !== undefined) {
			result += ", " + await this.exportPage(root, volume, chapter, page);
		} else {
			const pages = await Promise.all(project.volumes.getByIndex(volume)!.getByIndex(chapter)!
				.map((_, index) => this.exportPage(root, volume, chapter, index)));

			result += "\n\n# " + pages.join("\n\n\n# ");
		}

		File.download(`dialog-${volumeString}-${chapterString}${pageNumber !== undefined ? `-${pageNumber}` : ""}.md`, result);
	}

	public async import (root: string, volume: number, chapter: number) {
		const file = await Options.chooseFile("prompt-dialog-file", result => result.endsWith(".md"));

		if (!file) return;

		const text = await FileSystem.readFile(file, "utf8");

		const pageMatcher = /# Page (\d+)((?:(?:.|\r|\n)(?!# Page))*)/gm;

		for (const [, pageNumber, pageContent] of pageMatcher.matches(text)) {
			await this.importPage(root, volume, chapter, +pageNumber - 1, pageContent);
		}
	}

	private async exportPage (root: string, volume: number, chapter: number, page: number) {
		const project = Projects.get(root)!;
		const [, , pageNumber] = project.getNumbers(volume, chapter, page);
		let result = `Page ${pageNumber}\n\n`;

		const captures = await project.getPage(volume, chapter, page).captures;

		let lastCharacter: number | BasicCharacter | undefined;
		for (const capture of captures.captures) {
			if (capture.character && capture.character !== lastCharacter) {
				result += `## ${CharacterEditor.getName(capture.character)}\n\n`;
				lastCharacter = capture.character;
			}

			result += capture.text.trim()
				.split(/\r?\n/)
				.map(line => "> " + line)
				.join("\n") + "\n\n";

			if (capture.translation) result += capture.translation + "\n\n";

			const notes = capture.notes.filter(([f, n]) => f || n);
			if (notes.length) result += "| Text | Note |\n| --- | --- |\n" + notes
				.map(([f, n]) => `| ${f ? "`" : ""}${f.replace(/\s*\r?\n\s*/g, " ")}${f ? "`" : ""} | ${n.replace(/\s*\r?\n\s*/g, " ")} |`)
				.join("\n") + "\n\n";
		}

		return result;
	}

	private async importPage (root: string, volume: number, chapter: number, page: number, content: string) {
		const extractor = await app.extractPage(root, volume, chapter, page);

		const characterDialogMatcher = /## (.*?):((?:(?:.|\r|\n)(?!## .*?:))*)/gm;

		for (const [, character, dialogs] of characterDialogMatcher.matches(content)) {
			await this.importForCharacter(character, dialogs, extractor);
		}

		await extractor.updateJSON();
	}

	private async importForCharacter (characterName: string, content: string, extractor: Extractor) {
		let character = CharacterEditor.findCharacterByName(characterName) as CharacterData | number | BasicCharacter | undefined;
		if (character === undefined) character = await CharacterEditor.createCharacter(undefined, characterName);
		character = character === undefined ? BasicCharacter.Unknown : typeof character === "object" ? character.id : character;

		const dialogMatcher = /((?:> .*\r?\n)+)([^|]*)((?:(?:.|\r|\n)(?!> ))*)/gm;

		for (const [, dialog, translation, notesText] of dialogMatcher.matches(content)) {
			const japanese = this.parseDialog(dialog);
			const notes = this.parseNotes(notesText);

			await extractor.addCapture({
				text: japanese,
				translation: translation.trim(),
				notes: notes.toArray(),
				character,
			});
		}
	}

	private parseDialog (dialog: string) {
		return dialog.replace(/> /g, "").trim();
	}

	private parseNotes (notes: string) {
		notes = notes.replace(/(.|\n|\r)*--- \|\r?\n/m, "");

		return /\| (.*?) \| (.*?) \|/g.matches(notes)
			.map(([, foreign, note]) => tuple(foreign, note));
	}
}

const Dialog = new DialogImpl();

export default Dialog;
