namespace Objects {
	export function deepEquals (...objects: any[]) {
		if (new Set(objects.map(object => typeof object)).size > 1)
			return false;

		for (const object of objects) {
			if (typeof object === "object") {
				for (const key in object) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
					if (!deepEquals(...objects.map(object2 => object2[key])))
						return false;
				}

			} else if (!objects.every(object2 => object2 === object))
				return false;
		}

		return true;
	}

	export function deepMerge<A extends any[]> (...objects: A): A[number] {
		if (!objects.every(obj => typeof obj === "object")) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return objects.last();
		}

		if (objects.every(obj => Array.isArray(obj))) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return new Array<any>().concat(...objects as any[][]);
		}

		if (objects.some(obj => Array.isArray(obj))) {
			throw new Error("Can't merge an object & an array");
		}

		const result: any = {};
		for (const obj of objects) {
			for (const key in obj) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
				result[key] = result[key] ? deepMerge(result[key], obj[key]) : obj[key];
			}
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return result;
	}

	export function allEquals (...objects: any[]) {

	}
}

export default Objects;
