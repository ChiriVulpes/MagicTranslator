import type * as child_processType from "child_process";

let nodeChildProcess: typeof child_processType;

namespace ChildProcess {

	export function initialize (_nodeChildProcess: typeof child_processType) {
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
