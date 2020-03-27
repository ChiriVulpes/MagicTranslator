import Interrupt from "component/shared/Interrupt";
import { tuple } from "util/Arrays";
import ChildProcess from "util/ChildProcess";
import Concurrency from "util/Concurrency";
import FileSystem from "util/FileSystem";

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

const nonKanjiSyllabaries = [...Object.keys(katakanaToHiraganaMap), ...Object.values(katakanaToHiraganaMap)];

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

module Gloss {

	export async function gloss (phrase: string) {
		return (await getWords(phrase))
			.map(({ word, definitions }) => ({
				text: word,
				gloss: definitions.map(definition => "- " + definition).join("\n"),
			}));
	}
}

export default Gloss;

/**
 * Takes a phrase (in Japanese) and uses the glosser chosen by the user to gloss it.
 * (Gets a list of words in the phrase and lists their possible definitions)
 */
async function getWords (phrase: string) {
	phrase = phrase.replace(/\r?\n/g, " ");

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

/**
 * Glosses a phrase via Jisho.org.
 */
async function getWordsJisho (phrase: string): Promise<Stream<ExpectedGloss>> {
	return (await (await getMorphologicalWords(phrase))
		.flatMap(extractNumbers)
		.map(defineWord)
		.rest())
		.map(word => ({
			word: word.word,
			definitions: word.definitions.stream()
				.map(result => tuple(result, result.senses
					.map(sense => sense.english_definitions.join("/"))))
				.filter(([, definitions]) => definitions && definitions.length)
				.flatMap(([, definitions]) => definitions)
				.toArray(),
		}));
}


////////////////////////////////////
// Number & Counter Extraction
//

const numberRegex = RegExp(`^([${Object.keys(fullWidthToHalfWidthNumber).join("")}]+)(.*)`);

/**
 * Takes a morphological word (Jisho's gloss) and separates numbers from its counter
 * For example, given `１８歳`, which Jisho is unable to define, it returns `１８` and `歳`. Jisho can then define the `歳`
 */
function extractNumbers (word: Word): Word[] {
	const numberMatch = word.word.match(numberRegex);
	if (!numberMatch) return [word];
	return [
		{ word: numberMatch[1] },
		{ ...word, part_of_speech: "Suffix" as const, word: numberMatch[2] },
	];
}

/**
 * Takes a morphological word (Jisho's gloss), and adds a list of possible definitions.
 */
async function defineWord (word: Word) {
	return {
		...word,
		// don't attempt to gloss words that aren't morphologically analyzed
		definitions: !word.part_of_speech ? [] : await getDefinitions(word),
	};
}

/**
 * Returns the definitions for a word. If there are no definitions found, returns definitions for the furigana of the word.
 */
// tslint:disable-next-line cyclomatic-complexity
async function getDefinitions (word: Word) {
	let definitions: Definition[] | undefined;

	for (const wordText of word.furigana ? [word.word, word.furigana] : [word.word]) {
		const data = await concurrentFetchJson<PhraseSearchResult>(`${API_BASE_URI}?keyword="${wordText}"`, {});
		if (!data.data) continue;

		definitions = data.data;

		definitions.forEach(result => result.senses = repairAndFilterSenses(wordText, word.part_of_speech!, result.senses));
		definitions = definitions.filter(result => result.senses.length);

		if (definitions.some(result => result.is_common))
			definitions = definitions.filter(result => result.is_common);

		if (definitions.some(result => result.japanese.some(japanese => japanese.reading === wordText && !("word" in japanese))))
			definitions = definitions.filter(result => result.japanese.some(japanese => japanese.reading === wordText && !("word" in japanese)));

		if (definitions.some(result => isExactMatch(result, wordText)))
			definitions = definitions.filter(result => isExactMatch(result, wordText));

		if (wordText === word.furigana) {
			const baseWordKanji = Array.from(word.word).filter(char => !nonKanjiSyllabaries.includes(char));
			if (definitions.some(result => result.japanese.some(japanese => baseWordKanji.some(kanji => !!japanese.word && japanese.word.includes(kanji))))) {
				definitions = definitions.filter(result => !result.japanese.some(japanese => baseWordKanji.some(kanji => japanese.word.includes(kanji))));
			}
		}

		if (definitions.length) break;
	}

	return definitions || [];
}

/**
 * Returns whether the definition's word or reading matches the searched word exactly.
 */
function isExactMatch (definition: Definition, word: string) {
	const hiraganaWord = toHiragana(word);
	return definition.japanese.some(japanese => hiraganaWord.includes(toHiragana(japanese.word))
		|| hiraganaWord.includes(toHiragana(japanese.reading)));
}

/**
 * Jisho.org doesn't list all parts of speech for every "sense". Instead, when there are no parts of speech listed for a "sense",
 * they inherit the parts of speech of the previous sense. IE, the parts of speech cascade down.
 *
 * This function:
 * 1. "repairs" the senses so that they all have the correct parts of speech, following the cascade.
 * 2. Filters the senses by senses that match, if *any* of them match.
 */
function repairAndFilterSenses (word: string, partOfSpeech: keyof typeof PartOfSpeech, senses: Sense[]) {
	let lastPartsOfSpeech: string[] = [];
	for (const sense of senses) {
		if (!sense.parts_of_speech.length) sense.parts_of_speech = [...lastPartsOfSpeech];
		else lastPartsOfSpeech = sense.parts_of_speech;
	}

	if (senses.some(senseMatches.bind(null, word, partOfSpeech)))
		return senses.filter(senseMatches.bind(null, word, partOfSpeech));

	return senses;
}

/**
 * Returns whether a "sense" matches the searched word and its part of speech.
 *
 * This is only true if the part of speech matches, and the sense doesn't have a "restriction", or its "restriction" is to
 * the search's exact match.
 */
function senseMatches (word: string, partOfSpeech: keyof typeof PartOfSpeech, sense: Sense) {
	const hiraganaWord = toHiragana(word);
	return partsOfSpeechMatches(partOfSpeech, sense)
		&& (!sense.restrictions.length || sense.restrictions.some(restriction => toHiragana(restriction) === hiraganaWord));
}

function toHiragana (mixedSyllabaryText: string): string;
function toHiragana (mixedSyllabaryText?: string): string | undefined;
function toHiragana (mixedSyllabaryText?: string) {
	return mixedSyllabaryText && Array.from(mixedSyllabaryText)
		.map(char => char in katakanaToHiraganaMap ? katakanaToHiraganaMap[char as keyof typeof katakanaToHiraganaMap] : char)
		.join("");
}

/**
 * Returns whether the parts of speech of a given "sense" match a given part of speech.
 * 1. If given the part of speech "any", all senses match.
 * 2. If given the part of speech "Interjection", there are no parts of speech in the sense, and none of the definitions
 * look like suffixes, we accept the sense, assuming that it's an interjection.
 * TODO — figure out if this is still necessary. This was done before I realised that parts of speech needed to be cascaded down.
 * 3. If the sense is an "Expression", accept it. (Expressions are more likely than any other possible definition)
 * 4. If none of the above are true, return whether the parts of speech of the sense include the part of speech we're looking for.
 * (Keyword here is *include*. We could be looking for a verb, but the part of speech listed could be "transitive verb" or something)
 */
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

/**
 * Returns the morphologically-analyzed words for a Japanese phrase, retrieved by scraping the Jisho.org search page.
 */
async function getMorphologicalWords (phrase: string) {
	const xml = await concurrentFetchText(`${SCRAPE_BASE_URI}${phrase}`, "");
	if (!xml) return Stream.empty<Word>();

	const words = /<li\b.*?\bclass=".*?\bjapanese_word\b.*?>(.|\r|\n)*?<\/li>/g.matches(xml)
		.map(([match]) => extractWord(match));

	if (words.hasNext()) return words;

	return Stream.of<Word[]>({ word: phrase, part_of_speech: "any" });
}

/**
 * Takes XML that matches the markup of a morphologically-analyzed word on Jisho.org.
 */
function extractWord (wordXml: string): Word {
	return {
		word: (wordXml.match(/\bdata-word="([^"]*?)"/) || [])[1]
			|| (wordXml.match(/<span\b.*?\bclass="(?:japanese_word__text_wrapper|japanese_word__text_with_furigana)".*?>([^<]*?)<\/span>/) || [])[1],
		part_of_speech: (wordXml.match(/\bdata-pos="([^"]*?)"/) || [])[1] as keyof typeof PartOfSpeech,
		furigana: (wordXml.match(/<span\b.*?\bclass="japanese_word__furigana".*?>(.*?)<\/span>/) || [])[1],
	};
}

interface Word {
	word: string;
	furigana?: string;
	part_of_speech?: keyof typeof PartOfSpeech;
}

// The "part of speech" names below should match the tooltip text of morphologically-analyzed words on Jisho.org.
// There's likely a lot of parts of speech missing here.
enum PartOfSpeech {
	"any",
	// "any" is separate from all other parts of speech because it's something unique to this glossing functionality
	Noun,
	Particle,
	Adverb,
	Verb,
	Prefix,
	Suffix,
	"Proper noun",
}

interface PhraseSearchResult {
	meta?: { status: number };
	data?: Definition[];
}

interface Definition {
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


////////////////////////////////////
// Fetch Utilities
//

async function concurrentFetchJson<T> (path: string, defaultValue: T): Promise<T> {
	return concurrentFetch(path)
		.then(response => JSON.parse(response))
		.catch(err => {
			console.error(err);
			return defaultValue;
		});
}

async function concurrentFetchText (path: string, defaultValue: string): Promise<string> {
	return concurrentFetch(path)
		.catch(err => {
			console.error(err);
			return defaultValue;
		});
}

const concurrent = new Concurrency(1, 0.1);

async function concurrentFetch (path: string): Promise<string> {
	return concurrent.promise<string>(resolve => FileSystem.readFile(path, "utf8").then(resolve));
}
