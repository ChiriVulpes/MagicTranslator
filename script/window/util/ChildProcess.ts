let nodeChildProcess: typeof import("child_process");

module ChildProcess {

	export function initialize (_nodeChildProcess: typeof import("child_process")) {
		nodeChildProcess = _nodeChildProcess;
	}

	export async function exec (command: string) {
		return new Promise<[string | Buffer, string | Buffer]>((resolve, reject) => {
			nodeChildProcess.exec(command, (err, stdout: string | Buffer, stderr: string | Buffer) => {
				if (err) reject(err);
				else resolve([stdout, stderr]);
			});
		});
	}

}

export default ChildProcess;
