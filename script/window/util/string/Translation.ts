import { interpolate } from "util/string/Interpolator";
import Language from "util/string/Language";
import type Translations from "util/string/Translations";

export default class Translation<K extends string = keyof Translations> {

	public static exists (key: string) {
		return Language.current.exists(key as keyof Translations);
	}

	public get: K extends keyof Translations ? Translations[K] : (...args: any[]) => string;

	private readonly translationKey: K;

	public constructor (key: K);
	public constructor (key: string);
	public constructor (key: string) {
		this.translationKey = key as K;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		this.get = this.internalGetter as any;
	}

	@Bound private internalGetter (...args: any[]) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		return interpolate(Language.current.get(this.translationKey as keyof Translations) || "", ...args);
	}
}
