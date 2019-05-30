export module Objects {
	export function deepEquals (...objects: any[]) {
		if (new Set(objects.map(object => typeof object)).size > 1)
			return false;

		for (const object of objects) {
			if (typeof object === "object") {
				for (const key in object) {
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
			return objects.last();
		}

		if (objects.every(obj => Array.isArray(obj))) {
			return new Array<any>().concat(...objects as any[][]);
		}

		if (objects.some(obj => Array.isArray(obj))) {
			throw new Error("Can't merge an object & an array");
		}

		const result: any = {};
		for (const obj of objects) {
			for (const key in obj) {
				result[key] = result[key] ? deepMerge(result[key], obj[key]) : obj[key];
			}
		}

		return result;
	}

	export function allEquals (...objects: any[]) {

	}
}
