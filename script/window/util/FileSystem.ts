export default class FileSystem {

	private readonly fileWriteLocks = new Map<string, Promise<void>>();

	public constructor(
		private readonly nodefs: typeof import("fs"),
		private readonly path: typeof import("path"),
	) { }

	public async readdir (dir: string) {
		return new Promise<string[]>((resolve, reject) => {
			this.nodefs.readdir(dir, (err: NodeJS.ErrnoException | undefined, files) => {
				if (err) {
					if (err.code === "ENOENT") resolve([]);
					else reject(err);
				} else resolve(files);
			});
		});
	}

	public async readFile (path: string, encoding: string): Promise<string>;
	public async readFile (path: string): Promise<Buffer>;
	public async readFile (path: string, encoding?: string): Promise<string | Buffer>;
	public async readFile (path: string, encoding?: string) {
		return new Promise<string | Buffer>((resolve, reject) => {
			this.nodefs.readFile(path, encoding, (err: NodeJS.ErrnoException | undefined, file) => {
				if (err) reject(err);
				else resolve(file);
			});
		});
	}

	public async exists (path: string) {
		return new Promise<boolean>((resolve, reject) => {
			this.nodefs.stat(path, (err: NodeJS.ErrnoException | undefined, stats) => {
				resolve(!err);
			});
		});
	}

	public async writeFile (path: string, data: string | Buffer) {
		const absolutePath = this.path.resolve(path);

		await this.fileWriteLocks.get(absolutePath);

		const promise = new Promise<void>((resolve, reject) => {
			this.nodefs.writeFile(path, data, err => {
				this.fileWriteLocks.delete(absolutePath);

				if (err) reject(err);
				else resolve();
			});
		});

		this.fileWriteLocks.set(absolutePath, promise);

		return promise;
	}

	public async mkdir (path: string) {
		return new Promise<void>((resolve, reject) => {
			this.nodefs.mkdir(path, err => {
				if (err && err.code !== "EEXIST") reject(err);
				else resolve();
			});
		});
	}

	public async unlink (path: string, errorIfNotExist?: true): Promise<void>;
	public async unlink (path: string, errorIfNotExist = false) {
		return new Promise<void>((resolve, reject) => {
			this.nodefs.unlink(path, err => {
				if (err && errorIfNotExist) reject(err);
				else resolve();
			});
		});
	}
}
