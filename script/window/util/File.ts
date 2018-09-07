module File {
	export async function text (path: string) {
		return (await fetch(path)).text();
	}

	export function download (name: string, data: string) {
		const objectUrl = URL.createObjectURL(new Blob([data], { type: "text/plain" }));

		const linkElement = document.createElement("a");
		linkElement.href = objectUrl;
		linkElement.download = name;

		linkElement.click();
		linkElement.remove();
	}
}

export default File;
