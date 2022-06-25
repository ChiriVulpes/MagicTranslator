export function isIterable (obj: any): obj is Iterable<any> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return obj && typeof obj === "object" && Symbol.iterator in obj;
}
