// @ts-ignore inconsistent file casing (we just want the types from node's path module)
let nodePath: typeof import("path");

module Path {

	// @ts-ignore
	export function initialize (_nodePath: typeof import("path")) {
		nodePath = _nodePath;
	}

	export function join (...paths: string[]) {
		return nodePath.join(...paths)
			.replace(/\\/g, "/");
	}

	export function basename (path: string) {
		return nodePath.basename(path);
	}

	export function dirname (path: string) {
		return nodePath.dirname(path);
	}

	export function extname (path: string) {
		return nodePath.extname(path);
	}

	export function basenameNoExt (path: string) {
		return path.slice(0, -nodePath.extname(path).length);
	}
}

export default Path;
