import Interrupt from "component/shared/Interrupt";
import JishoApi, { Result, Sense } from "unofficial-jisho-api";
import { tuple } from "util/Arrays";
import ChildProcess from "util/ChildProcess";
import Concurrency from "util/Concurrency";
import Stream from "util/stream/Stream";

let jishoApi: JishoApi;

const SCRAPE_BASE_URI = "http://jisho.org/search/";

const katakanaToHiraganaMap = {
	ア: "あ",
	カ: "か",
	ガ: "が",
	サ: "さ",
	ザ: "ざ",
	タ: "た",
	ダ: "だ",
	ナ: "な",
	ハ: "は",
	バ: "ば",
	パ: "ぱ",
	マ: "ま",
	ヤ: "や",
	ラ: "ら",
	ワ: "わ",
	イ: "い",
	キ: "き",
	ギ: "ぎ",
	シ: "し",
	ジ: "じ",
	チ: "ち",
	ヂ: "ぢ",
	ニ: "に",
	ヒ: "ひ",
	ビ: "び",
	ピ: "ぴ",
	ミ: "み",
	リ: "り",
	ヰ: "ゐ",
	ウ: "う",
	ク: "く",
	グ: "ぐ",
	ス: "す",
	ズ: "ず",
	ツ: "つ",
	ヅ: "づ",
	ヌ: "ぬ",
	フ: "ふ",
	ブ: "ぶ",
	プ: "ぷ",
	ム: "む",
	ユ: "ゆ",
	ル: "る",
	エ: "え",
	ケ: "け",
	ゲ: "げ",
	セ: "せ",
	ゼ: "ぜ",
	テ: "て",
	デ: "で",
	ネ: "ね",
	ヘ: "へ",
	ベ: "べ",
	ペ: "ぺ",
	メ: "め",
	レ: "れ",
	ヱ: "ゑ",
	オ: "お",
	コ: "こ",
	ゴ: "ご",
	ソ: "そ",
	ゾ: "ぞ",
	ト: "と",
	ド: "ど",
	ノ: "の",
	ホ: "ほ",
	ボ: "ぼ",
	ポ: "ぽ",
	モ: "も",
	ヨ: "よ",
	ロ: "ろ",
	ヲ: "を",
	ン: "ん",
};

function toHiragana (mixedSyllabaryText: string): string;
function toHiragana (mixedSyllabaryText?: string): string | undefined;
function toHiragana (mixedSyllabaryText?: string) {
	return mixedSyllabaryText && Array.from(mixedSyllabaryText)
		.map(char => char in katakanaToHiraganaMap ? katakanaToHiraganaMap[char as keyof typeof katakanaToHiraganaMap] : char)
		.join("");
}

module Gloss {
	export function initialize (_jishoApi: typeof JishoApi) {
		jishoApi = new _jishoApi();
	}

	export interface Word extends MorphologicalWord {
		results: Result[];
	}

	const concurrent = new Concurrency(1, 0.1);

	export async function gloss (phrase: string) {
		return (await getWords(phrase))
			.map(({ word, definitions }) => ({
				text: word,
				gloss: definitions.map(definition => "- " + definition).join("\n"),
			}));
	}

	async function getWords (phrase: string) {
		if (!options.glosserCLIPath) return getWordsJisho(phrase);

		try {
			const [stdout] = await ChildProcess.exec(`"${options.glosserCLIPath}" "${phrase}"`);
			const results = JSON.parse(stdout.toString("utf8")) as ExpectedGloss[];

			const isValid = Array.isArray(results)
				&& results.every(result => typeof result === "object"
					&& typeof result.word === "string"
					&& Array.isArray(result.definitions)
					&& result.definitions.every(definition => typeof definition === "string"));
			if (!isValid) throw new Error("Gloss result JSON is invalid. Expected an array of objects containing a word and its definitions.");

			return results.stream();

		} catch (err) {
			console.error(err);

			await Interrupt.info(interrupt => interrupt
				.setTitle("info-error-on-gloss")
				.setDescription(() => err.message));

			return Stream.empty<ExpectedGloss>();
		}
	}

	interface ExpectedGloss {
		word: string;
		definitions: string[];
	}

	async function getWordsJisho (phrase: string, includeUnlikely?: boolean): Promise<Stream<ExpectedGloss>> {
		return (await (await getMorphologicalWords(phrase))
			.map(word => concurrent.promise<Word>(async resolve => resolve({
				...word,
				results: !word.part_of_speech ? [] // don't attempt to gloss words that aren't morphologically analyzed
					: await getResults(word, includeUnlikely),
			})))
			.rest())
			.map(word => ({
				word: word.word,
				definitions: word.results.stream()
					.map(result => tuple(result, result.senses
						.map(sense => sense.english_definitions.join("/"))))
					.filter(([, definitions]) => definitions && definitions.length)
					.flatMap(([, definitions]) => definitions)
					.toArray(),
			}));
	}

	async function getResults (word: MorphologicalWord, includeUnlikely = false) {
		let results = (await jishoApi.searchForPhrase(word.word)).data;
		if (includeUnlikely) return results;

		results.forEach(result => result.senses = repairAndFilterSenses(word, result.senses));
		results = results.filter(result => result.senses.length);

		if (results.some(result => result.is_common))
			results = results.filter(result => result.is_common);

		if (results.some(result => result.japanese.some(japanese => japanese.reading === word.word && !("word" in japanese))))
			results = results.filter(result => result.japanese.some(japanese => japanese.reading === word.word && !("word" in japanese)));

		if (results.some(result => isExactMatch(result, word)))
			results = results.filter(result => isExactMatch(result, word));

		return results;
	}

	function isExactMatch (result: Result, word: MorphologicalWord) {
		const hiraganaWord = toHiragana(word.word);
		return result.japanese.some(japanese => hiraganaWord.includes(toHiragana(japanese.word))
			|| hiraganaWord.includes(toHiragana(japanese.reading)));
	}

	function repairAndFilterSenses (word: MorphologicalWord, senses: Sense[]) {
		// Jisho.org doesn't list all parts of speech for every "sense", ones with no parts of speech
		// that follow ones with parts of speech are supposed to inherit them
		let lastPartsOfSpeech: string[] = [];
		for (const sense of senses) {
			if (!sense.parts_of_speech.length) sense.parts_of_speech = [...lastPartsOfSpeech];
			else lastPartsOfSpeech = sense.parts_of_speech;
		}

		return senses.filter(senseMatches.bind(null, word));
	}

	function senseMatches (word: MorphologicalWord, sense: Sense) {
		const hiraganaWord = toHiragana(word.word);
		return partsOfSpeechMatches(word.part_of_speech!, sense)
			&& (!sense.restrictions.length || sense.restrictions.some(restriction => toHiragana(restriction) === hiraganaWord));
	}

	function partsOfSpeechMatches (lookingFor: string, sense: Sense) {
		if (!sense.parts_of_speech.length && lookingFor === "Interjection") {
			if (sense.english_definitions.some(def => def.startsWith("-"))) {
				sense.parts_of_speech.push("Suffix");
			} else return true;
		}

		if (sense.parts_of_speech.includes("Expression")) return true;

		lookingFor = lookingFor.toLowerCase();
		return sense.parts_of_speech.some(part => part.toLowerCase().includes(lookingFor));
	}
}

export default Gloss;

async function getMorphologicalWords (phrase: string) {
	const result = await fetch(`${SCRAPE_BASE_URI}${phrase}`);
	const xml = await result.text();
	return /<li\b.*?\bclass=".*?\bjapanese_word\b.*?>(.|\r|\n)*?<\/li>/g.matches(xml)
		.map(([match]) => extractWord(match));
}

function extractWord (wordXml: string): MorphologicalWord {
	return {
		word: (wordXml.match(/\bdata-word="([^"]*?)"/) || [])[1]
			|| (wordXml.match(/<span\b.*?\bclass="japanese_word__text_wrapper".*?>([^<]*?)<\/span>/) || [])[1],
		part_of_speech: (wordXml.match(/\bdata-pos="([^"]*?)"/) || [])[1] as keyof typeof PartOfSpeech,
		furigana: (wordXml.match(/<span\b.*?\bclass="japanese_word__furigana".*?>(.*?)<\/span>/) || [])[1],
	};
}

interface MorphologicalWord {
	word: string;
	furigana?: string;
	part_of_speech?: keyof typeof PartOfSpeech;
}

enum PartOfSpeech {
	Noun,
	Particle,
	Adverb,
	Verb,
}
