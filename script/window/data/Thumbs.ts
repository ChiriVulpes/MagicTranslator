import Serializable, { Serialized } from "data/Serialized";
import { sleep } from "util/Async";
import Canvas from "util/Canvas";
import Concurrency, { CancellablePromise } from "util/Concurrency";
import FileSystem from "util/FileSystem";
import Path from "util/string/Path";

interface Thumb {
	modificationTime: number;
	id: number;
}

export default class Thumbs extends Serializable {
	@Serialized private thumbIndex = 0;
	@Serialized private readonly thumbs: { [key: string]: Thumb | undefined } = {};
	private readonly updates = new Map<string, CancellablePromise<any>>();

	public constructor (private readonly root: string) {
		super(`${root}.json`);
	}

	public async get (filename: string) {
		if (await this.needsUpdate(filename)) await this.update(filename);
		return this.getThumbFilename(filename);
	}

	public cancel (filename: string) {
		const promise = this.updates.get(filename);
		if (promise) {
			promise.cancel();
			this.updates.delete(filename);
		}
	}

	private getThumbFilename (filenameOrId: string | number): string;
	private getThumbFilename (filenameOrId?: string | number) {
		if (typeof filenameOrId === "string") filenameOrId = this.thumbs[filenameOrId] && this.thumbs[filenameOrId]!.id;
		return typeof filenameOrId === undefined ? undefined : Path.join(this.root, `${filenameOrId}.png`);
	}

	private async update (filename: string) {
		if (this.updates.has(filename)) return;

		const id = this.thumbs[filename] ? this.thumbs[filename]!.id : this.thumbIndex++;
		const thumbFilename = this.getThumbFilename(id)!;

		const downscalingPromise = downScaleImage(filename, 350 / 1600);
		this.updates.set(filename, downscalingPromise);

		const canvas = await downscalingPromise;
		this.updates.delete(filename);

		if (!canvas) return;

		await FileSystem.priority.mkdir(this.root);
		await Canvas.saveToFile(thumbFilename, canvas);

		this.thumbs[filename] = { modificationTime: Date.now(), id };
	}

	private async needsUpdate (filename: string) {
		const thumb = this.thumbs[filename];
		if (!thumb) return true;

		const stats = await FileSystem.stat(filename);
		if (!stats) {
			await this.remove(filename);
			return false;
		}

		return thumb.modificationTime < stats.mtime.getTime();
	}

	private async remove (filename: string) {
		const thumb = this.getThumbFilename(filename);
		if (thumb) await FileSystem.unlink(thumb);
		delete this.thumbs[filename];
	}
}

const concurrent = new Concurrency(2);

// tslint:disable cyclomatic-complexity one-variable-per-declaration no-bitwise
// taken from https://stackoverflow.com/a/19144434/2778047

// scales the image by (float) scale < 1
// returns a canvas containing the scaled image.
function downScaleImage (filename: string, scale: number) {
	return concurrent.promise<HTMLCanvasElement>(async resolve => {
		const img = new Image();
		img.src = filename;

		await new Promise(resolve2 => img.addEventListener("load", resolve2));

		const imgCV = document.createElement("canvas");
		imgCV.width = img.width;
		imgCV.height = img.height;
		const imgCtx = imgCV.getContext("2d")!;
		imgCtx.drawImage(img, 0, 0);
		downScaleCanvas(imgCV, scale).then(resolve);
	});
}

// scales the canvas by (float) scale < 1
// returns a new canvas containing the scaled image.
async function downScaleCanvas (cv: HTMLCanvasElement, scale: number) {
	if (!(scale < 1) || !(scale > 0)) throw new Error("scale must be a positive number < 1");
	const sqScale = scale * scale; // square scale = area of source pixel within target
	const sw = cv.width; // source image width
	const sh = cv.height; // source image height
	const tw = Math.floor(sw * scale); // target image width
	const th = Math.floor(sh * scale); // target image height
	let sx = 0, sy = 0, sIndex = 0; // source x,y, index within source array
	let tx = 0, ty = 0, yIndex = 0, tIndex = 0; // target x,y, x,y index within target array
	let tX = 0, tY = 0; // rounded tx, ty
	let w = 0, nw = 0, wx = 0, nwx = 0, wy = 0, nwy = 0; // weight / next weight x / y
	// weight is weight of current source point within target.
	// next weight is weight of current source point within next target's point.
	let crossX = false; // does scaled px cross its current px right border ?
	let crossY = false; // does scaled px cross its current px bottom border ?
	const sBuffer = cv.getContext("2d")!.getImageData(0, 0, sw, sh).data; // source buffer 8 bit rgba
	const tBuffer = new Float32Array(3 * tw * th); // target buffer Float32 rgb
	let sR = 0, sG = 0, sB = 0; // source's current point r,g,b
	/* untested !
    var sA = 0;  //source alpha  */

	let time = Date.now();
	for (sy = 0; sy < sh; sy++) {
		ty = sy * scale; // y src position within target
		tY = 0 | ty;     // rounded : target pixel's y
		yIndex = 3 * tY * tw;  // line index within target array
		crossY = (tY !== (0 | ty + scale));
		if (crossY) { // if pixel is crossing botton target pixel
			wy = (tY + 1 - ty); // weight of point within target pixel
			nwy = (ty + scale - tY - 1); // ... within y+1 target pixel
		}
		for (sx = 0; sx < sw; sx++ , sIndex += 4) {
			tx = sx * scale; // x src position within target
			tX = 0 | tx;    // rounded : target pixel's x
			tIndex = yIndex + tX * 3; // target pixel index within target array
			crossX = (tX !== (0 | tx + scale));
			if (crossX) { // if pixel is crossing target pixel's right
				wx = (tX + 1 - tx); // weight of point within target pixel
				nwx = (tx + scale - tX - 1); // ... within x+1 target pixel
			}
			sR = sBuffer[sIndex];   // retrieving r,g,b for curr src px.
			sG = sBuffer[sIndex + 1];
			sB = sBuffer[sIndex + 2];

			/* !! untested : handling alpha !!
               sA = sBuffer[sIndex + 3];
               if (!sA) continue;
               if (sA != 0xFF) {
                   sR = (sR * sA) >> 8;  // or use /256 instead ??
                   sG = (sG * sA) >> 8;
                   sB = (sB * sA) >> 8;
               }
            */
			if (!crossX && !crossY) { // pixel does not cross
				// just add components weighted by squared scale.
				tBuffer[tIndex] += sR * sqScale;
				tBuffer[tIndex + 1] += sG * sqScale;
				tBuffer[tIndex + 2] += sB * sqScale;
			} else if (crossX && !crossY) { // cross on X only
				w = wx * scale;
				// add weighted component for current px
				tBuffer[tIndex] += sR * w;
				tBuffer[tIndex + 1] += sG * w;
				tBuffer[tIndex + 2] += sB * w;
				// add weighted component for next (tX+1) px
				nw = nwx * scale;
				tBuffer[tIndex + 3] += sR * nw;
				tBuffer[tIndex + 4] += sG * nw;
				tBuffer[tIndex + 5] += sB * nw;
			} else if (crossY && !crossX) { // cross on Y only
				w = wy * scale;
				// add weighted component for current px
				tBuffer[tIndex] += sR * w;
				tBuffer[tIndex + 1] += sG * w;
				tBuffer[tIndex + 2] += sB * w;
				// add weighted component for next (tY+1) px
				nw = nwy * scale;
				tBuffer[tIndex + 3 * tw] += sR * nw;
				tBuffer[tIndex + 3 * tw + 1] += sG * nw;
				tBuffer[tIndex + 3 * tw + 2] += sB * nw;
			} else { // crosses both x and y : four target points involved
				// add weighted component for current px
				w = wx * wy;
				tBuffer[tIndex] += sR * w;
				tBuffer[tIndex + 1] += sG * w;
				tBuffer[tIndex + 2] += sB * w;
				// for tX + 1; tY px
				nw = nwx * wy;
				tBuffer[tIndex + 3] += sR * nw;
				tBuffer[tIndex + 4] += sG * nw;
				tBuffer[tIndex + 5] += sB * nw;
				// for tX ; tY + 1 px
				nw = wx * nwy;
				tBuffer[tIndex + 3 * tw] += sR * nw;
				tBuffer[tIndex + 3 * tw + 1] += sG * nw;
				tBuffer[tIndex + 3 * tw + 2] += sB * nw;
				// for tX + 1 ; tY +1 px
				nw = nwx * nwy;
				tBuffer[tIndex + 3 * tw + 3] += sR * nw;
				tBuffer[tIndex + 3 * tw + 4] += sG * nw;
				tBuffer[tIndex + 3 * tw + 5] += sB * nw;
			}

			if (Date.now() - time > 3) {
				await sleep(0);
				time = Date.now();
			}
		} // end for sx
	} // end for sy

	// create result canvas
	const resCV = document.createElement("canvas");
	resCV.width = tw;
	resCV.height = th;
	const resCtx = resCV.getContext("2d")!;
	const imgRes = resCtx.getImageData(0, 0, tw, th);
	const tByteBuffer = imgRes.data;
	// convert float32 array into a UInt8Clamped Array
	let pxIndex = 0;
	for (sIndex = 0, tIndex = 0; pxIndex < tw * th; sIndex += 3, tIndex += 4, pxIndex++) {
		tByteBuffer[tIndex] = Math.ceil(tBuffer[sIndex]);
		tByteBuffer[tIndex + 1] = Math.ceil(tBuffer[sIndex + 1]);
		tByteBuffer[tIndex + 2] = Math.ceil(tBuffer[sIndex + 2]);
		tByteBuffer[tIndex + 3] = 255;
	}
	// writing result to canvas.
	resCtx.putImageData(imgRes, 0, 0);
	return resCV;
}
