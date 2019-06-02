import CharacterEditor from "component/content/character/CharacterEditor";
import Extractor from "component/content/Extractor";
import { BasicCharacter, CharacterData } from "data/Characters";
import Projects from "data/Projects";
import Options from "Options";
import { tuple } from "util/Arrays";
import FileSystem from "util/FileSystem";

export class DialogImpl {
	public async export (volume: number, chapter: number, page?: number) {
		const project = Projects.current!;
		const [volumeString, chapterString] = project.getPathSegments(volume, chapter);
		const [volumeNumber, chapterNumber, pageNumber] = project.getSegmentNumbers(volume, chapter, page);

		let result = `# Volume ${volumeNumber}, Chapter ${chapterNumber}`;

		if (page !== undefined) {
			result += ", " + await this.exportPage(volume, chapter, page);
		} else {
			const pages = await Promise.all(project.volumes.getByIndex(volume)!.getByIndex(chapter)!
				.map((_, index) => this.exportPage(volume, chapter, index)));

			result += "\n\n# " + pages.join("\n\n\n# ");
		}

		const directory = project.getChapterDirectory("raw", volumeNumber, chapterNumber);
		FileSystem.writeToUserChoice(result, `${directory}/dialog-${volumeString}-${chapterString}${page === undefined ? "" : `-${pageNumber}`}.md`);
	}

	public async import (volume: number, chapter: number) {
		const file = await Options.chooseFile("prompt-dialog-file", result => result.endsWith(".md"));

		if (!file) return;

		const text = await FileSystem.readFile(file, "utf8");

		const pageMatcher = /# Page (\d+)((?:(?:.|\r|\n)(?!# Page))*)/gm;

		for (const [, pageNumber, pageContent] of pageMatcher.matches(text)) {
			await this.importPage(volume, chapter, +pageNumber - 1, pageContent);
		}
	}

	private async exportPage (volume: number, chapter: number, page: number) {
		const project = Projects.current!;
		const [, , pageNumber] = project.getSegmentNumbers(volume, chapter, page);
		let result = `Page ${pageNumber}\n\n`;

		const captures = await project.getPage(volume, chapter, page).captures;

		let lastCharacter: number | BasicCharacter | undefined;
		for (const capture of captures.captures) {
			if (capture.character && capture.character !== lastCharacter) {
				result += `## ${project.characters.getName(capture.character)}\n\n`;
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

	private async importPage (volume: number, chapter: number, page: number, content: string) {
		const extractor = await app.extractPage(volume, chapter, page);

		const characterDialogMatcher = /## (.*?):((?:(?:.|\r|\n)(?!## .*?:))*)/gm;

		for (const [, character, dialogs] of characterDialogMatcher.matches(content)) {
			await this.importForCharacter(character, dialogs, extractor);
		}

		await extractor.updateJSON();
	}

	private async importForCharacter (characterName: string, content: string, extractor: Extractor) {
		let character = Projects.current!.characters.findByName(characterName) as CharacterData | number | BasicCharacter | undefined;
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
