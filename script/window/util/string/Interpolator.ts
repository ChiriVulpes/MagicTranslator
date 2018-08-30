// tslint:disable cyclomatic-complexity FIXME

import FollowKeys from "util/FollowKeys";
import { isIterable } from "util/IterableIterator";

export interface SegmentApi {
	interpolate (str: string, ...args: any[]): StringSection[];
}

export interface Segment {
	startChar?: string;
	endChar?: string;
	regex: RegExp;
	handle (match: RegExpMatchArray, segment: string, api: SegmentApi, ...args: any[]): string | StringSection | IterableOf<StringSection>;
}

export interface StringSection {
	content: string;
}

class Interpolator {
	private readonly _segments: Segment[];
	public get segments () { return [...this._segments]; }

	public constructor(...segments: Segment[]) {
		this._segments = segments.map(segment => ({ ...segment }));

		this.interpolate = this.interpolate.bind(this);
	}

	public interpolate (str: string, ...args: any[]) {
		let section = { content: "" };
		const sections: StringSection[] = [section];

		for (let i = 0; i < str.length; i++) {
			if (str[i] === "\\") {
				section.content += str[i + 1];
				i++;
				continue;
			}

			const matchingSegments = this.handleChar(str, i);
			if (!matchingSegments.length) {
				section.content += str[i];
				continue;
			}

			let startCharLength = 0;

			if (matchingSegments.length === 1) {
				i += startCharLength = (matchingSegments[0].startChar || "{").length - 1;
			}

			let endCharLength = 0;

			let levels = 0;
			let j = i + 1;
			for (; j < str.length; j++) {
				if (str[j] === "\\") {
					j++;
					continue;
				}

				if (str[j] === "{") {
					levels++;

				} else if (str[j] === "}") {
					levels--;

				} else {
					for (const { endChar } of matchingSegments) {
						if ((endChar || "}")[0] === str[j] && str.slice(j).startsWith(endChar || "}")) {
							endCharLength = (endChar || "}").length - 1;
							levels--;
							break;
						}
					}
				}

				if (levels < 0) {
					break;
				}
			}

			// we broke because of string length, so we have to ignore this segment and continue as if it's a normal character
			if (levels >= 0) {
				section.content += str.slice(i - startCharLength, i + 1);
				continue;
			}

			const segment = str.slice(i + 1, j);
			let matched = false;

			// check if any of the segments match
			for (const { regex, handle } of matchingSegments) {
				const match = segment.match(regex);
				if (!match) {
					continue;
				}

				matched = true;

				// this segment matched, so we let it handle it
				let result = handle(match, segment, this, ...args);

				// process its result (can be a string, a section, or a list of sections)
				if (typeof result === "string") {
					result = { content: result };
				}

				result = isIterable(result) ? [...result] : [result];

				// filter out the empty sections
				result = result.filter(s => s.content.length > 0);

				// only do things if there are actually sections left
				if (result.length > 0) {
					// create a new "last section" to append to, first appending all the new sections that the segment gave us
					section = { content: "" };
					sections.push(...result, section);
				}

				// we're not going to need any of the content inside this segment anymore, so pass through it
				i = j + endCharLength;

				break;
			}

			// when we can't match the segment we display it in all its ugly glory
			if (!matched) {
				section.content += str[i];
			}
		}

		// get rid of the first section if it's empty
		if (!sections[0].content) {
			sections.shift();
		}

		// get rid of the last section if it's empty
		if (!section.content) {
			sections.pop();
		}

		return sections;
	}

	private handleChar (str: string, i: number) {
		const matchingSegments = [];
		for (const segment of this._segments) {
			const match = segment.startChar || "{";
			if (str[i] === match[0]) {
				if (match.length === 1 || (str.slice(i).startsWith(match))) {
					matchingSegments.push(segment);
				}
			}
		}

		return matchingSegments;
	}

	public static combineLikeSections (sections: StringSection[], ignoreKeys: string[] = []) {
		if (sections.length < 2) {
			return;
		}

		Sections: for (let i = 1; i < sections.length; i++) {
			const current = sections[i];
			const last = sections[i - 1];

			for (const key in last) {
				if (key === "content" || ignoreKeys.includes(key)) {
					continue;
				}

				if (!(key in current)) {
					continue Sections;
				}
			}

			for (const key in current) {
				if (key === "content" || ignoreKeys.includes(key)) {
					continue;
				}

				if (!(key in last) || current[key as keyof typeof current] !== last[key as keyof typeof last]) {
					continue Sections;
				}
			}

			// remove `current`, put its content into `last`
			last.content += current.content;
			sections.splice(i, 1);
			i--;
		}
	}
}

module Interpolator {
	export function getArgument (keyMap: string, ...args: any[]) {
		const keys = keyMap.split(".");
		if (isNaN(+keys[0])) {
			keys.unshift("0");
		}

		// follow the directions to get the result that we want to print
		return FollowKeys<string>(args, keys);
	}

	export function getIndexOfTopLevel (character: string, segment: string) {
		let layer = 0;
		for (let i = 0; i < segment.length; i++) {
			switch (segment[i]) {
				case "\\":
					i++;
					break;

				case "{":
					layer++;
					break;

				case "}":
					layer--;
					if (layer < 0) layer = 0;
					break;

				case character[0]:
					if (layer === 0) return i;
					break;
			}
		}

		return -1;
	}
}

export default Interpolator;

export const argumentSegment: Segment = {
	regex: /^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/,
	handle: (_, segment, api, ...args) => {
		const result = Interpolator.getArgument(segment, ...args);
		return result === undefined ? "" : isIterable(result) ? result as IterableOf<StringSection> : `${result}`;
	},
};

export const conditionalSegment: Segment = {
	regex: /^([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)\?/,
	handle: ([, argument], segment, api, ...args) => {
		let colonIndex = Interpolator.getIndexOfTopLevel(":", segment);
		colonIndex = colonIndex === -1 ? Infinity : colonIndex;
		const result = Interpolator.getArgument(argument, ...args) ? segment.slice(argument.length + 1, colonIndex) : segment.slice(colonIndex + 1);
		return api.interpolate(result, ...args);
	},
};

export const padSegment: Segment = {
	regex: /^pad\((\d+):(.*?)\):(.*?)$/,
	handle: ([, padToLength, padWith, toPad], segment, api, ...args) => {
		const sections = api.interpolate(toPad, ...args);
		const len = sections.reduce((l, section) => l + section.content.length, 0);
		if (len >= +padToLength) return sections;

		const padLength = +padToLength - len;
		const padWithSections = api.interpolate(padWith, ...args);
		const padWithLength = padWithSections.reduce((l, section) => l + section.content.length, 0);
		for (let totalLength = 0; totalLength < padLength; totalLength += padWithLength) {
			sections.unshift(...padWithSections);
		}

		return sections;
	},
};

export const basicInterpolator = new Interpolator(argumentSegment, conditionalSegment, padSegment);

export function interpolateSectioned (str: string, ...args: any[]) {
	return basicInterpolator.interpolate(str, ...args);
}

export function interpolate (str: string, ...args: any[]) {
	return basicInterpolator.interpolate(str, ...args).map(section => section.content).join("");
}
