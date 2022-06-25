import FileSystem from "util/FileSystem";
import Path from "util/string/Path";

namespace Canvas {
	export async function saveToFile (filename: string, canvas: HTMLCanvasElement) {
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

		await FileSystem.mkdir(Path.dirname(filename));
		await FileSystem.writeFile(filename, buffer);
	}
}

export default Canvas;
