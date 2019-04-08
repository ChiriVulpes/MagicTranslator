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
}
