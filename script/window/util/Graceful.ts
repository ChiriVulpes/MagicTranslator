export class Graceful<T> {
	private ifFailReturn: T | undefined;
	private errorMessage = "Gracefully caught an error";
	private sources: string[];

	public constructor (...sources: string[]) {
		this.sources = sources.length ? sources : ["Graceful"];
	}

	public setFailureReturn (failureReturn: T) {
		this.ifFailReturn = failureReturn;
		return this;
	}

	public setErrorMessage (message: string) {
		this.errorMessage = message;
		return this;
	}

	public setSources (...sources: string[]) {
		this.sources = sources;
		return this;
	}

	public execute<T1 = any> (functionToCallGracefully: (arg1: T1, ...args: any[]) => T) {
		return (...args: any[]) => {
			try {
				return (functionToCallGracefully as any)(...args);
			} catch (err) {
				console.error(`[${this.sources.join(", ")}]`, this.errorMessage, err);
			}

			return this.ifFailReturn;
		};
	}
}
