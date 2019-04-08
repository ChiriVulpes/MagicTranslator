export default class Concurrency {

	private concurrentCount = 0;
	private readonly waiting: (() => void)[] = [];

	public constructor (private readonly maxConcurrent = 1) { }

	public async promise<T> (initializer: (resolve: (value: T) => any, reject: (error: any) => any) => any): Promise<T>;
	// public async promise<T> (promise: () => Promise<T>): Promise<T>;
	public async promise<T> (initializer: (resolve: (v?: any) => any, reject: (error: any) => any) => any): Promise<T> {
		if (this.concurrentCount >= this.maxConcurrent) await new Promise(res => this.waiting.push(res));
		this.concurrentCount++;
		let err: any;
		const result = await new Promise(initializer).catch(e => err = e);
		this.concurrentCount--;
		if (this.waiting.length) this.waiting.shift()!();
		if (err) throw err;
		return result;
	}
}
