import Characters from "data/Characters";
import Volumes from "data/Volumes";
import { tuple } from "util/Arrays";
import FileSystem from "util/FileSystem";

export default new class Media extends Map<string, MediaRoot> {
	public async load () {
		(await this.getRoots())
			.toMap(this);
	}

	public async addRoot (root: string) {
		this.set(root, await MediaRoot.initialize(root));
	}

	private async getRoots () {
		return options.rootFolders.stream()
			.map(async root => tuple(root, await MediaRoot.initialize(root)))
			.rest();
	}
};

interface RootMetadata {
	name?: string;
	structure: {
		volume: string;
		chapter: string;
		page: string;
	};
}

class MediaRoot {

	public static async initialize (root: string) {
		const jsonData = await FileSystem.readFile(`${root}/metadata.json`, "utf8")
			.catch(() => { });

		const metadata: Partial<RootMetadata> = JSON.parse(jsonData || "{}");

		return new MediaRoot(root, await Volumes.get(root), metadata.name, metadata.structure);
	}

	public readonly characters = new Characters(this.root);

	public get name () { return this._name; }
	public set name (name: string | undefined) { this._name = name; this.save(); }

	public get structure () { return this._structure; }
	public set structure (structure: RootMetadata["structure"]) { this._structure = structure; this.save(); }

	private constructor (
		private readonly root: string,
		public readonly volumes: Volumes,
		private _name?: string,
		private _structure: RootMetadata["structure"] = {
			volume: "vol##",
			chapter: "ch###",
			page: "###",
		},
	) { }

	private async save () {
		const data: RootMetadata = {
			name: this._name,
			structure: this._structure,
		};

		await FileSystem.writeFile(`${this.root}/metadata.json`, JSON.stringify(data, undefined, "\t"));
	}
}
