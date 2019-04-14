import { sleep } from "util/Async";

export default class Concurrency {

	private concurrentCount = 0;
	private readonly waiting: (() => void)[] = [];

	public constructor (private readonly maxConcurrent = 1, private readonly timeoutSeconds = 0) { }

	public promise<T> (initializer: (resolve: (value: T) => any, reject: (error: any) => any) => any): Promise<T>;
	public promise<T> (cancellable: true, initializer: (resolve: (value: T) => any, reject: (error: any) => any) => any): CancellablePromise<T>;
	public promise<T> (cancellable: any, initializer?: (resolve: (v?: any) => any, reject: (error: any) => any) => any): CancellablePromise<T> {
		if (!initializer) initializer = cancellable, cancellable = true;
		return new CancellablePromise<T>(async (resolve, reject, isCancelled) => {
			if (this.concurrentCount >= this.maxConcurrent) await new Promise(res => this.waiting.push(res));

			let err: any;
			let result!: T;

			if (!isCancelled()) {
				this.concurrentCount++;
				result = await new Promise(initializer!).catch(e => err = e);
				this.concurrentCount--;
			}

			if (this.timeoutSeconds) await sleep(this.timeoutSeconds);

			if (this.waiting.length) this.waiting.shift()!();

			if (err) reject(err);
			resolve(result);
		});
	}
}

export class CancellablePromise<T> extends Promise<T | undefined> {

	private _isCancelled: boolean;
	public get isCancelled () { return this._isCancelled; }

	public constructor (initializer: (resolve: (value: T) => any, reject: (error: any) => any, isCancelled: () => boolean) => any) {
		let resolve!: (value: T) => any;
		let reject!: (error?: any) => any;
		super((_resolve, _reject) => (resolve = _resolve, reject = _reject));
		this._isCancelled = false;
		initializer(resolve, reject, () => this.isCancelled);
	}

	@Bound public cancel () {
		this._isCancelled = true;
	}
}
