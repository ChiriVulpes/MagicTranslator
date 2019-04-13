import { tuple } from "util/Arrays";
import { TriggerHandler, Triggers } from "util/FieldSetTriggers";
import FileSystem from "util/FileSystem";
import { Objects } from "util/Objects";
import Path from "util/string/Path";

export { Triggers as Serialized };

@TriggerHandler("save")
export default class Serializable {

	protected canSave = false;
	private saving?: Promise<void>;
	private readonly filesystem: typeof FileSystem;

	public constructor (private readonly path: string, priority = false) {
		this.filesystem = priority ? FileSystem.priority as any : FileSystem;
	}

	public async load () {
		this.canSave = false;

		const translationData = await this.loadInternal();
		for (const field of Triggers.get(this)) {
			this[field] = field in translationData ? translationData[field] : this[field];
		}

		this.canSave = true;

		return this;
	}

	public async save () {
		if (!this.canSave) return;

		await this.saving;
		this.saving = this.saveInternal();
		await this.saving;
		delete this.saving;
	}

	protected shouldSaveFileExist () {
		return true;
	}

	private async loadInternal () {
		const jsonData = await this.filesystem.readFile(this.path, "utf8")
			.catch(() => { });

		if (jsonData) try {
			return JSON.parse(jsonData);
		} catch (err) {
			const ext = Path.extname(this.path);
			await this.filesystem.rename(this.path, this.path.slice(0, -ext.length) + ".error" + ext);
		}

		return {};
	}

	private async saveInternal () {
		if (!this.shouldSaveFileExist())
			return this.filesystem.unlink(this.path);

		await this.filesystem.mkdir(Path.dirname(this.path));

		const translationData = await this.loadInternal();
		const newTranslationData = Triggers.get(this).stream()
			.map(field => tuple(field, Triggers.getNonProxyValue(this, field)))
			.toObject();

		if (Objects.deepEquals(translationData, newTranslationData)) return;

		await this.filesystem.writeFile(this.path, JSON.stringify(newTranslationData, undefined, "\t"));
	}
}
