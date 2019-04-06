let nodefs: typeof import("fs");
let path: typeof import("path");
const fileWriteLocks = new Map<string, Promise<void>>();

module FileSystem {

	export function initialize (nodefs_: typeof import("fs"), path_: typeof import("path")) {
		nodefs = nodefs_;
		path = path_;
	}

	export async function readdir (dir: string) {
		return new Promise<string[]>((resolve, reject) => {
			nodefs.readdir(dir, (err: NodeJS.ErrnoException | undefined, files) => {
				if (err) {
					if (err.code === "ENOENT") resolve([]);
					else reject(err);
				} else resolve(files);
			});
		});
	}

	export async function readFile (filepath: string, encoding: string): Promise<string>;
	export async function readFile (filepath: string): Promise<Buffer>;
	export async function readFile (filepath: string, encoding?: string): Promise<string | Buffer>;
	export async function readFile (filepath: string, encoding?: string) {
		return new Promise<string | Buffer>((resolve, reject) => {
			nodefs.readFile(filepath, encoding, (err: NodeJS.ErrnoException | undefined, file) => {
				if (err) reject(err);
				else resolve(file);
			});
		});
	}

	export async function exists (filepath: string) {
		return new Promise<boolean>((resolve, reject) => {
			nodefs.stat(filepath, (err: NodeJS.ErrnoException | undefined, stats) => {
				resolve(!err);
			});
		});
	}

	export async function writeFile (filepath: string, data: string | Buffer) {
		const absolutePath = path.resolve(filepath);

		await fileWriteLocks.get(absolutePath);

		const promise = new Promise<void>((resolve, reject) => {
			nodefs.writeFile(filepath, data, err => {
				fileWriteLocks.delete(absolutePath);

				if (err) reject(err);
				else resolve();
			});
		});

		fileWriteLocks.set(absolutePath, promise);

		return promise;
	}

	export async function mkdir (filepath: string) {
		return new Promise<void>((resolve, reject) => {
			nodefs.mkdir(filepath, err => {
				if (err && err.code !== "EEXIST") reject(err);
				else resolve();
			});
		});
	}

	export async function unlink (filepath: string, errorIfNotExist?: true): Promise<void>;
	export async function unlink (filepath: string, errorIfNotExist = false) {
		return new Promise<void>((resolve, reject) => {
			nodefs.unlink(filepath, err => {
				if (err && errorIfNotExist) reject(err);
				else resolve();
			});
		});
	}
}

export default FileSystem;
