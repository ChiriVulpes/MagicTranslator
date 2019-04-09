import Concurrency from "util/Concurrency";

let nodefs: typeof import("fs");
let path: typeof import("path");

const fileWriteLocks = new Map<string, Promise<void>>();

class FileSystem {

	private readonly concurrent: Concurrency;

	public constructor (concurrentMax = 5) {
		this.concurrent = new Concurrency(concurrentMax);
	}

	public async readdir (dir: string) {
		return this.concurrent.promise<string[]>((resolve, reject) => {
			nodefs.readdir(dir, (err: NodeJS.ErrnoException | undefined, files) => {
				if (err) {
					if (err.code === "ENOENT") resolve([]);
					else reject(err);
				} else resolve(files);
			});
		});
	}

	public async readFile (filepath: string, encoding: string): Promise<string>;
	public async readFile (filepath: string): Promise<Buffer>;
	public async readFile (filepath: string, encoding?: string): Promise<string | Buffer>;
	public async readFile (filepath: string, encoding?: string) {
		return this.concurrent.promise<string | Buffer>((resolve, reject) => {
			nodefs.readFile(filepath, encoding, (err: NodeJS.ErrnoException | undefined, file) => {
				if (err) reject(err);
				else resolve(file);
			});
		});
	}

	public async exists (filepath: string) {
		return new Promise<boolean>((resolve, reject) => {
			nodefs.stat(filepath, (err: NodeJS.ErrnoException | undefined, stats) => {
				resolve(!err);
			});
		});
	}

	public async writeFile (filepath: string, data: string | Buffer) {
		const absolutePath = path.resolve(filepath);

		await fileWriteLocks.get(absolutePath);

		const promise = this.concurrent.promise<void>((resolve, reject) => {
			nodefs.writeFile(filepath, data, err => {
				fileWriteLocks.delete(absolutePath);

				if (err) reject(err);
				else resolve();
			});
		});

		fileWriteLocks.set(absolutePath, promise);

		return promise;
	}

	public async mkdir (filepath: string) {
		return this.concurrent.promise<void>((resolve, reject) => {
			nodefs.mkdir(filepath, err => {
				if (err && err.code !== "EEXIST") reject(err);
				else resolve();
			});
		});
	}

	public async unlink (filepath: string, errorIfNotExist?: true): Promise<void>;
	public async unlink (filepath: string, errorIfNotExist = false) {
		return this.concurrent.promise<void>((resolve, reject) => {
			nodefs.unlink(filepath, err => {
				if (err && errorIfNotExist) reject(err);
				else resolve();
			});
		});
	}

	public async rename (filepath: string, newFilepath: string) {
		return this.concurrent.promise<void>((resolve, reject) => {
			nodefs.rename(filepath, newFilepath, err => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

}

export default new class extends FileSystem {

	public priority = new FileSystem(Infinity);

	public initialize (nodefs_: typeof import("fs"), path_: typeof import("path")) {
		nodefs = nodefs_;
		path = path_;
	}
};
