export default function <T> (target: any, directions: string[]): T | undefined {
	for (const key of directions) {
		target = target[key];
		if (target === undefined) {
			return undefined;
		}
	}

	return target;
}
