import { tuple } from "util/Arrays";
import { TriggerHandler, Triggers } from "util/FieldSetTriggers";
import FileSystem from "util/FileSystem";
import { Objects } from "util/Objects";

export { Triggers as Serialized };

@TriggerHandler("save")
export default class Serializable {

	protected canSave = false;
	private saving?: Promise<void>;

	public constructor (private readonly path: string) { }

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
		const jsonData = await FileSystem.readFile(this.path, "utf8")
			.catch(() => { });

		if (jsonData) try {
			return JSON.parse(jsonData);
		} catch (err) {
			const ext = path.extname(this.path);
			await FileSystem.rename(this.path, this.path.slice(0, -ext.length) + ".error" + ext);
		}

		return {};
	}

	private async saveInternal () {
		if (!this.shouldSaveFileExist())
			return FileSystem.unlink(this.path);

		await FileSystem.mkdir(path.dirname(this.path));

		const translationData = await this.loadInternal();
		const newTranslationData = Triggers.get(this).stream()
			.map(field => tuple(field, Triggers.getNonProxyValue(this, field)))
			.toObject();

		if (Objects.deepEquals(translationData, newTranslationData)) return;

		await FileSystem.writeFile(this.path, JSON.stringify(newTranslationData, undefined, "\t"));
	}
}
