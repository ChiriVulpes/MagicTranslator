module File {
	export async function text (path: string) {
		return (await fetch(path)).text();
	}

	export async function shader (path: string) {
		const shaderText = await (await fetch("./shader/" + path)).text();
		return shaderText.replace(/\/\/ threejs:start(.|\n|\r)*\/\/ threejs:end/, "");
	}
}

export default File;
