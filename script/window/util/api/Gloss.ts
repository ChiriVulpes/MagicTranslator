import Interrupt from "component/shared/Interrupt";
import { tuple } from "util/Arrays";
import ChildProcess from "util/ChildProcess";
import Concurrency from "util/Concurrency";
import Stream from "util/stream/Stream";

const API_BASE_URI = "http://jisho.org/api/v1/search/words/";
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

const fullWidthToHalfWidthNumber = {
	"０": "0",
	"１": "1",
	"２": "2",
	"３": "3",
	"４": "4",
	"５": "5",
	"６": "6",
	"７": "7",
	"８": "8",
	"９": "9",
};

const numberRegex = RegExp(`^([${Object.keys(fullWidthToHalfWidthNumber).join("")}]+)(.*)`);

const nonKanjiSyllabaries = [...Object.keys(katakanaToHiraganaMap), ...Object.values(katakanaToHiraganaMap)];

function toHiragana (mixedSyllabaryText: string): string;
function toHiragana (mixedSyllabaryText?: string): string | undefined;
function toHiragana (mixedSyllabaryText?: string) {
	return mixedSyllabaryText && Array.from(mixedSyllabaryText)
		.map(char => char in katakanaToHiraganaMap ? katakanaToHiraganaMap[char as keyof typeof katakanaToHiraganaMap] : char)
		.join("");
}

module Gloss {

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

	async function getWordsJisho (phrase: string): Promise<Stream<ExpectedGloss>> {
		return (await (await getMorphologicalWords(phrase))
			.flatMap(word => {
				const numberMatch = word.word.match(numberRegex);
				if (!numberMatch) return [word];
				return [
					{ word: numberMatch[1] },
					{ ...word, part_of_speech: "Suffix" as const, word: numberMatch[2] },
				];
			})
			.map(word => concurrent.promise<Word>(async resolve => resolve({
				...word,
				results: !word.part_of_speech ? [] // don't attempt to gloss words that aren't morphologically analyzed
					: await getResults(word),
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

	// tslint:disable-next-line cyclomatic-complexity
	async function getResults (word: MorphologicalWord) {
		let results!: Result[];

		for (const wordText of word.furigana ? [word.word, word.furigana] : [word.word]) {
			const response = await fetch(`${API_BASE_URI}?keyword="${wordText}"`);
			const data: PhraseSearchResult = await response.json();
			results = data.data;

			results.forEach(result => result.senses = repairAndFilterSenses(wordText, word.part_of_speech!, result.senses));
			results = results.filter(result => result.senses.length);

			if (results.some(result => result.is_common))
				results = results.filter(result => result.is_common);

			if (results.some(result => result.japanese.some(japanese => japanese.reading === wordText && !("word" in japanese))))
				results = results.filter(result => result.japanese.some(japanese => japanese.reading === wordText && !("word" in japanese)));

			if (results.some(result => isExactMatch(result, wordText)))
				results = results.filter(result => isExactMatch(result, wordText));

			if (wordText === word.furigana) {
				const baseWordKanji = Array.from(word.word).filter(char => !nonKanjiSyllabaries.includes(char));
				if (results.some(result => result.japanese.some(japanese => baseWordKanji.some(kanji => japanese.word.includes(kanji))))) {
					results = results.filter(result => !result.japanese.some(japanese => baseWordKanji.some(kanji => japanese.word.includes(kanji))));
				}
			}

			if (results.length) break;
		}

		return results;
	}

	function isExactMatch (result: Result, word: string) {
		const hiraganaWord = toHiragana(word);
		return result.japanese.some(japanese => hiraganaWord.includes(toHiragana(japanese.word))
			|| hiraganaWord.includes(toHiragana(japanese.reading)));
	}

	function repairAndFilterSenses (word: string, partOfSpeech: keyof typeof PartOfSpeech, senses: Sense[]) {
		// Jisho.org doesn't list all parts of speech for every "sense", ones with no parts of speech
		// that follow ones with parts of speech are supposed to inherit them
		let lastPartsOfSpeech: string[] = [];
		for (const sense of senses) {
			if (!sense.parts_of_speech.length) sense.parts_of_speech = [...lastPartsOfSpeech];
			else lastPartsOfSpeech = sense.parts_of_speech;
		}

		if (senses.some(senseMatches.bind(null, word, partOfSpeech)))
			return senses.filter(senseMatches.bind(null, word, partOfSpeech));

		return senses;
	}

	function senseMatches (word: string, partOfSpeech: keyof typeof PartOfSpeech, sense: Sense) {
		const hiraganaWord = toHiragana(word);
		return partsOfSpeechMatches(partOfSpeech, sense)
			&& (!sense.restrictions.length || sense.restrictions.some(restriction => toHiragana(restriction) === hiraganaWord));
	}

	function partsOfSpeechMatches (lookingFor: string, sense: Sense) {
		if (lookingFor === "any") return true;

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

	const words = /<li\b.*?\bclass=".*?\bjapanese_word\b.*?>(.|\r|\n)*?<\/li>/g.matches(xml)
		.map(([match]) => extractWord(match));

	if (words.hasNext()) return words;

	return Stream.of<MorphologicalWord[]>({ word: phrase, part_of_speech: "any" });
}

function extractWord (wordXml: string): MorphologicalWord {
	return {
		word: (wordXml.match(/\bdata-word="([^"]*?)"/) || [])[1]
			|| (wordXml.match(/<span\b.*?\bclass="(?:japanese_word__text_wrapper|japanese_word__text_with_furigana)".*?>([^<]*?)<\/span>/) || [])[1],
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
	"any",
	Noun,
	Particle,
	Adverb,
	Verb,
	Prefix,
	Suffix,
	"Proper noun",
}

interface PhraseSearchResult {
	meta: { status: number };
	data: Result[];
}

interface Result {
	slug: string;
	is_common: boolean;
	tags: string[];
	jlpt: string[];
	japanese: Japanese[];
	senses: Sense[];
	attribution: {
		jmdict: boolean;
		jmnedict: boolean;
		dbpedia: boolean;
	};
}

interface Japanese {
	word: string;
	reading: string;
}

interface Sense {
	english_definitions: string[];
	parts_of_speech: string[];
	links: string[];
	restrictions: string[];
	see_also: string[];
	antonyms: string[];
	source: string[];
	info: string[];
}
