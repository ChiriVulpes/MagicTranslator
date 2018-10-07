import Bound from "util/Bound";
import { interpolate } from "util/string/Interpolator";
import Language from "util/string/Language";
import Translations from "util/string/Translations";

export default class Translation<K extends string = keyof Translations> {
	public get: K extends keyof Translations ? Translations[K] : (...args: any[]) => string;

	private readonly translationKey: K;

	public constructor(key: K);
	public constructor(key: string);
	public constructor(key: string) {
		this.translationKey = key as K;
		this.get = this.internalGetter as any;
	}

	@Bound
	private internalGetter (...args: any[]) {
		return interpolate(Language.current.get(this.translationKey as keyof Translations) || "", ...args);
	}
}
