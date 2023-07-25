import type * as pathType from "path";

let nodePath: typeof pathType;

namespace Path {

	export function initialize (_nodePath: typeof pathType) {
		nodePath = _nodePath;
	}

	export function join (...paths: string[]) {
		return nodePath.join(...paths)
			.replace(/\\/g, "/");
	}

	export function relative (from: string, ...paths: string[]) {
		return nodePath.relative(from, nodePath.join(...paths))
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
