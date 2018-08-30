export function pad (n: number | string, width: number, z?: number | string) {
	z = z || "0";
	n = `${n}`;
	return n.length >= width ? n : new Array(width - n.length + 1).join(`${z}`) + n;
}
