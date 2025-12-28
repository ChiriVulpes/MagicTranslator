import type * as fsType from "fs/promises";
import type * as pathType from "path";
import Concurrency from "util/Concurrency";

let nodefs: typeof fsType;
let path: typeof pathType;

const fileWriteLocks = new Map<string, Promise<void>>();

class FileSystemMethods {

	private readonly concurrent: Concurrency;

	public constructor (concurrentMax = 5) {
		this.concurrent = new Concurrency(concurrentMax);
	}

	public async readdir (dir: string) {
		return this.concurrent.promise<string[]>((resolve, reject) =>
			nodefs.readdir(dir)
				.catch(err => err.code === "ENOENT" ? [] : reject(err))
				.then(resolve));
	}

	public async readFile (filepath: string, encoding: BufferEncoding): Promise<string>;
	public async readFile (filepath: string): Promise<Buffer>;
	public async readFile (filepath: string, encoding?: BufferEncoding): Promise<string | Buffer>;
	public async readFile (filepath: string, encoding?: BufferEncoding) {
		return this.concurrent.promise<string | Buffer>((resolve, reject) =>
			nodefs.readFile(filepath, encoding).catch(reject).then(resolve));
	}

	public async exists (filepath: string) {
		return nodefs.stat(filepath).catch(() => false).then(() => true);
	}

	public async stat (filepath: string) {
		return nodefs.stat(filepath).catch(() => undefined);
	}

	public async writeFile (filepath: string, data: string | Buffer) {
		const absolutePath = path.resolve(filepath);

		await fileWriteLocks.get(absolutePath);

		const promise = this.concurrent.promise<void>((resolve, reject) =>
			nodefs.writeFile(filepath, data)
				.catch(reject).then(resolve)
				.finally(() => fileWriteLocks.delete(absolutePath)));

		fileWriteLocks.set(absolutePath, promise);

		return promise;
	}

	public async mkdir (filepath: string) {
		return this.concurrent.promise<void>((resolve, reject) =>
			this.mkdirp(filepath).then(resolve).catch(reject));
	}

	public async unlink (filepath: string, errorIfNotExist?: true): Promise<void>;
	public async unlink (filepath: string, errorIfNotExist = false) {
		return this.concurrent.promise<void>((resolve, reject) =>
			nodefs.unlink(filepath).catch(err => errorIfNotExist ? reject(err) : resolve()).then(resolve));
	}

	public async rename (filepath: string, newFilepath: string) {
		return this.concurrent.promise<void>((resolve, reject) =>
			nodefs.rename(filepath, newFilepath).catch(reject).then(resolve));
	}

	public async writeToUserChoice (data: string, defaultPath?: string) {
		const dialog = await window.send<Electron.SaveDialogReturnValue>("dialog-show-save", { defaultPath } as Electron.SaveDialogOptions);
		if (!dialog.filePath) return;
		void this.writeFile(dialog.filePath, data);
	}

	private async mkdirp (filepath: string): Promise<void> {
		filepath = path.resolve(filepath);

		return nodefs.mkdir(filepath).catch(err => {
			if (err.code === "EEXIST") return undefined;

			if (err.code === "ENOENT") {
				return this.mkdirp(path.dirname(filepath))
					.then(() => this.mkdirp(filepath));
			}

			throw err;
		}).then(async () => {
			const stat = await nodefs.stat(filepath);
			if (!stat.isDirectory())
				throw new Error("Path is not a directory");
		});
	}

}

class FileSystem extends FileSystemMethods {

	public priority = new FileSystemMethods(Infinity);

	public initialize (
		nodefs_: typeof fsType,
		path_: typeof pathType,
	) {
		nodefs = nodefs_;
		path = path_;
	}
}

export default new FileSystem;
