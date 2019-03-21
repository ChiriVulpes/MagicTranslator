import Translations from "util/string/Translations";

export default class Language {
	public static current: Language;
	private static fallback: Language;
	private static languageWaiters: ((language: Language) => any)[] = [];

	public static async initialize () {
		const locale = await window.send<string>("get-locale");

		const fallbackResponse = await fetch("./lang/en-US.quilt");
		Language.fallback = new Language("en-US", await fallbackResponse.text());

		const response = await fetch(`./lang/${locale}.quilt`).catch(() => {
			console.warn(`The locale ${locale} is not supported. =(`);
		});
		Language.current = response ? new Language(locale, await response.text()) : Language.fallback;

		for (const waiter of Language.languageWaiters) waiter(Language.current);
	}

	public static async waitForLanguage () {
		if (Language.current) return Language.current;
		return new Promise<Language>(resolve => Language.languageWaiters.push(resolve));
	}

	public readonly locale: string;
	private quilt: { [K in keyof Translations]?: string } = {};

	private constructor (locale: string, quilt: string) {
		this.locale = locale;
		this.importQuilt(`${quilt}\n`);
	}

	public get (translation: keyof Translations): string {
		if (translation in this.quilt) return this.quilt[translation]!;
		if (this !== Language.fallback) return Language.fallback.get(translation);
		console.warn(`Unknown/invalid translation: '${translation}'`);
		return "";
	}

	// tslint:disable cyclomatic-complexity
	private importQuilt (quiltText: string) {
		let inside: "key" | "value" = "key";

		const quilt: { [key: string]: string } = {};

		const kv = { key: "", value: "" };

		for (let i = 0; i < quiltText.length; i++) {
			if (quiltText[i] === ":" && inside === "key") {
				i++;
				if (quiltText[i] === " ") i++;
				inside = "value";
			}

			if (quiltText[i] === "\\" && inside === "value") {
				const char = quiltText[++i];
				if (char === "n") {
					kv[inside] += "\n";
					continue;
				}
				if (char === ":") {
					kv[inside] += "\\:";
					continue;
				}
			}

			if (quiltText[i] === "\n") {
				i++;
				inside = "key";
				if (kv.key.trim()) quilt[kv.key] = kv.value;
				kv.key = "";
				kv.value = "";
			}

			if (quiltText[i] !== "\r") kv[inside] += quiltText[i];
		}

		this.quilt = quilt;
	}
}
