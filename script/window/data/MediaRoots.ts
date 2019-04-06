import Characters from "data/Characters";
import Volumes from "data/Volumes";
import { tuple } from "util/Arrays";

interface MediaRoot {
	characters: Characters;
	volumes: Volumes;
}

class Media extends Map<string, MediaRoot> {
	public async load () {
		(await this.getRoots())
			.toMap(this);
	}

	public async addRoot (root: string) {
		this.set(root, await this.getRoot(root));
	}

	////////////////////////////////////
	// Loading the map of Volumes/Chapters/Pages
	//

	private async getRoots () {
		return options.rootFolders.stream()
			.map(async root => tuple(root, await this.getRoot(root)))
			.rest();
	}

	private async getRoot (root: string): Promise<MediaRoot> {
		return {
			characters: new Characters(root),
			volumes: await Volumes.get(root),
		};
	}
}

export default new Media();
