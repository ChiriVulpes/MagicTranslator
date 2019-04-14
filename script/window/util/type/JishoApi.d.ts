declare module "unofficial-jisho-api" {

	// todo?
	type RequestOptions = any;

	/**
	 * A wrapper around the Jisho.org API and this library's scraping functionality.
	 */
	export default class API {
		/**
		 * @param requestOptions Options to pass to request to customize request behavior. See request for available options. 
		 * requestOptions passed into this constructor can be overriden by passing requestOptions to the search methods.
		 */
		constructor (requestOptions?: RequestOptions);

		/**
		 * Scrape the word page for a word/phrase.
		 * @param phrase The search term to search for.
		 * @param requestOptions Options to pass to request to customize request behavior. See request for available options.
		 * 
		 * This allows you to get some information that isn't provided
		 * by the official API, such as part-of-speech and JLPT level. However, the official API should be preferred
		 * if it has the information you need.
		 *
		 * This function scrapes https://jisho.org/word/XXX.
		 *
		 * In general, you'll want to include kanji in your search term, for example 掛かる instead of かかる (no results).
		 */
		scrapeForPhrase (phrase: string, requestOptions?: RequestOptions): Promise<PhrasePageScrapeResult>;

		/**
		 * @param phrase The word or phrase to search for.
		 * @param requestOptions Options to pass to request to customize request behavior. See request for available options.
		 */
		searchForExamples (phrase: string, requestOptions?: RequestOptions): Promise<ExampleResults>;

		/**
		 * Scrape Jisho.org for information about a kanji character.
		 * @param kanji The kanji to search for.
		 * @param requestOptions Options to pass to request to customize request behavior. See request for available options.
		 */
		searchForKanji (kanji: string, requestOptions?: RequestOptions): Promise<KanjiResult>;

		/**
		 * Query the official Jisho API for a word or phrase.
		 * @param phrase The search term to search for.
		 * @param requestOptions Options to pass to request to customize request behavior. See request for available options.
		 */
		searchForPhrase (phrase: string, requestOptions?: RequestOptions): Promise<PhraseSearchResult>;
	}

	export interface PhraseSearchResult {
		meta: { status: number };
		data: Result[];
	}

	export interface Result {
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
		}
	}

	export interface Japanese {
		word: string;
		reading: string;
	}

	export interface Sense {
		english_definitions: string[];
		parts_of_speech: string[];
		links: string[];
		restrictions: string[];
		see_also: string[];
		antonyms: string[];
		source: string[];
		info: string[];
	}

	export interface ExampleResults {
		/**
		 * The term that you searched for.
		 */
		query: string;
		/**
		 * True if results were found.
		 */
		found: boolean;
		/**
		 * The URI that these results were scraped from.
		 */
		uri: string;
		/**
		 * The examples that were found, if any.
		 */
		results: ExampleResultData[];
	}

	export interface ExampleResultData {
		/**
		 * The example sentence including kanji.
		 */
		kanji: string;
		/**
		 * The example sentence without kanji (only kana). Sometimes this may include some Kanji, as furigana is not always available from Jisho.org.
		 */
		kana: string;
		/**
		 * An English translation of the example.
		 */
		english: string;
		/**
		 * The lifted/unlifted pairs that make up the sentence. Lifted text is furigana, unlifted is the text below the furigana.
		 */
		pieces: ExampleSentencePiece[];
	}

	export interface KanjiResult {
		/**
		 * True if results were found.
		 */
		found: boolean;
		/**
		 * The term that you searched for.
		 */
		query: string;
		/**
		 * The school level that the kanji is taught in, if applicable.
		 */
		taughtIn?: string;
		/**
		 * The lowest JLPT exam that this kanji is likely to appear in, if applicable. 'N5' or 'N4' or 'N3' or 'N2' or 'N1'.
		 */
		jlptLevel?: string;
		/**
		 * A number representing this kanji's frequency rank in newspapers, if applicable.
		 */
		newspaperFrequencyRank?: number;
		/**
		 * How many strokes this kanji is typically drawn in, if applicable.
		 */
		strokeCount?: number;
		/**
		 * The meaning of the kanji, if applicable.
		 */
		meaning?: string;
		/**
		 * This character's kunyomi, if applicable.
		 */
		kunyomi?: string[];
		/**
		 * Examples of this character's kunyomi being used, if applicable.
		 */
		kunyomiExamples?: YomiExample[];
		/**
		 * This character's onyomi, if applicable.
		 */
		onyomi?: string;
		/**
		 * Examples of this character's onyomi being used, if applicable.
		 */
		onyomiExamples?: YomiExample[];
		/**
		 * Information about this character's radical, if applicable.
		 */
		radical?: {
			/**
			 * The radical symbol, if applicable.
			 */
			symbol?: string;
			/**
			 * The radical forms used in this kanji, if applicable.
			 */
			forms?: string[];
			/**
			 * The meaning of the radical, if applicable.
			 */
			meaning?: string;
		},
		/**
		 * The parts used in this kanji, if applicable.
		 */
		parts?: string[];
		/**
		 * The URL to a diagram showing how to draw this kanji step by step, if applicable.
		 */
		strokeOrderDiagramUri?: string;
		/**
		 * The URL to an SVG describing how to draw this kanji, if applicable.
		 */
		strokeOrderSvgUri?: string;
		/**
		 * The URL to a gif showing the kanji being draw and its stroke order, if applicable.
		 */
		strokeOrderGifUri?: string;
		/**
		 * The URI that these results were scraped from, if applicable.
		 */
		uri?: string;
	}

	export interface PhrasePageScrapeResult {
		/**
		 * True if a result was found.
		 */
		found: boolean;
		/**
		 * The term that you searched for.
		 */
		query: string;
		/**
		 * The URI that these results were scraped from, if a result was found.
		 */
		uri?: string;
		/**
		 * Other forms of the search term, if a result was found.
		 */
		otherForms?: string[];
		/**
		 * Information about the meanings associated with result.
		 */
		meanings?: PhraseScrapeMeaning[];
		/**
		 * Tags associated with this search result.
		 */
		tags?: string[];
	}

	export interface PhraseScrapeMeaning {
		/**
		 * The words that Jisho lists as "see also".
		 */
		seeAlsoTerms: string[];
		/**
		 * Example sentences for this meaning.
		 */
		sentences: PhraseScrapeSentence[];
		/**
		 * The definition.
		 */
		definition: string;
		/**
		 * Supplemental information. For example "usually written using kana alone".
		 */
		supplemental: string[];
		/**
		 * An "abstract" definition. Often this is a Wikipedia definition.
		 */
		definitionAbstract: string;
		/**
		 * Tags associated with this meaning.
		 */
		tags: string[];
	}

	export interface PhraseScrapeSentence {
		/**
		 * The English meaning of the sentence.
		 */
		english: string;
		/**
		 * The Japanese text of the sentence.
		 */
		japanese: string;
		/**
		 * The lifted/unlifted pairs that make up the sentence. Lifted text is furigana, unlifted is the text below the furigana.
		 */
		pieces: ExampleSentencePiece[];
	}

	export interface ExampleSentencePiece {
		/**
		 * Baseline text shown on Jisho.org (below the lifted text / furigana)
		 */
		unlifted: string;
		/**
		 * Furigana text shown on Jisho.org (above the unlifted text)
		 */
		lifted: string;
	}

	export interface YomiExample {
		/**
		 * The original text of the example.
		 */
		example: string;
		/**
		 * The reading of the example.
		 */
		reading: string;
		/**
		 * The meaning of the example.
		 */
		meaning: string;
	}
}