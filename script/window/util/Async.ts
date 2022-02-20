export function sleep (s: number) {
	return new Promise<void>(resolve => setTimeout(resolve, s * 1000));
}

export type Resolve<T> = (value: T | PromiseLike<T>) => void;
export type Reject = (reason?: any) => void;

export class ResolvablePromise<T = void> extends Promise<T> {
	public readonly resolve: Resolve<T>;
	public readonly reject: Reject;

	private _isResolved: boolean;

	public get isResolved () {
		return this._isResolved;
	}

	constructor (executor?: (resolve: Resolve<T>, reject: Reject) => void) {
		let resolve!: Resolve<T>;
		let reject!: Reject;

		super((_resolve, _reject) => {
			resolve = (value: T | PromiseLike<T>) => {
				this._isResolved = true;
				_resolve(value);
			};
			reject = _reject;
		});

		this._isResolved = false;

		this.resolve = resolve;
		this.reject = reject;

		if (executor) {
			executor(resolve, reject);
		}
	}
}
