export default class FileSystem {

	public constructor(private readonly nodefs: typeof import("fs")) { }

	public async readdir (dir: string) {
		return new Promise<string[]>((resolve, reject) => {
			this.nodefs.readdir(dir, (err: NodeJS.ErrnoException | undefined, files) => {
				if (err) reject(err);
				else resolve(files);
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
		return new Promise<void>((resolve, reject) => {
			this.nodefs.writeFile(path, data, err => {
				if (err) reject(err);
				else resolve();
			});
		});
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
