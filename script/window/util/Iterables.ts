export function isIterable (obj: any): obj is Iterable<any> {
	return obj && typeof obj === "object" && Symbol.iterator in obj;
}
