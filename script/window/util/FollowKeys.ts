export default function <T> (target: any, directions: string[]): T | undefined {
	for (const key of directions) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,  @typescript-eslint/no-unsafe-member-access
		target = target[key];
		if (target === undefined) {
			return undefined;
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return target;
}
