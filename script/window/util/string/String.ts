export function pad (n: number | string, width: number, z?: number | string) {
	z = z || "0";
	n = `${n}`;
	return n.length >= width ? n : new Array(width - n.length + 1).join(`${z}`) + n;
}

export function mask (maskString: string, inputString: string) {
	inputString = inputString.padEnd(maskString.length, " ");
	let output = "";
	for (let i = 0; i < maskString.length; i++) {
		if (maskString[i] !== " ") {
			output += inputString[i];
		}
	}
	return output;
}
