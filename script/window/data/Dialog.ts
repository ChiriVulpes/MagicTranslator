import CharacterEditor from "component/content/character/CharacterEditor";
import Captures from "data/Captures";
import { BasicCharacter } from "data/Characters";
import Volumes from "data/Volumes";
import File from "util/File";

export class DialogImpl {
	public async export (volume: number, chapter: number, page?: number) {
		const [volumeString, chapterString] = Volumes.getPaths(volume, chapter);
		const [volumeNumber, chapterNumber, pageNumber] = Volumes.getNumbers(volume, chapter, page);

		let result = `# Volume ${volumeNumber}, Chapter ${chapterNumber}`;

		if (page !== undefined) {
			result += ", " + await this.exportPage(volume, chapter, page);
		} else {
			const pages = await Promise.all(Volumes.getByIndex(volume)!.getByIndex(chapter)!
				.map((_, index) => this.exportPage(volume, chapter, index)));

			result += "\n\n# " + pages.join("\n\n\n# ");
		}


		File.download(`dialog-${volumeString}-${chapterString}${pageNumber !== undefined ? `-${pageNumber}` : ""}.md`, result);
	}

	private async exportPage (volume: number, chapter: number, page: number) {
		const [, , pageNumber] = Volumes.getNumbers(volume, chapter, page);
		let result = `Page ${pageNumber}\n\n`;

		const data = await Captures.load(volume, chapter, page);

		let lastCharacter: number | BasicCharacter | undefined;
		for (const capture of data.captures) {
			if (capture.character && capture.character !== lastCharacter) {
				result += `## ${CharacterEditor.getName(capture.character)}\n\n`;
				lastCharacter = capture.character;
			}

			result += capture.text.trim()
				.split(/\r?\n/)
				.map(line => "> " + line)
				.join("\n") + "\n\n";

			if (capture.translation) result += capture.translation + "\n\n";

			const notes = capture.notes.filter(([f, n]) => f && n);
			if (notes.length) result += "| Text | Note |\n| --- | --- |\n" + notes
				.map(([f, n]) => `| \`${f.replace(/\s*\r?\n\s*/g, " ")}\` | ${n.replace(/\s*\r?\n\s*/g, " ")} |`)
				.join("\n") + "\n\n";
		}

		return result;
	}
}

const Dialog = new DialogImpl();

export default Dialog;
