////////////////////////////////////
// Initialization
// Deletes the `nodeRequire` function so other files can't use it, does any needed initialization
// using those apis beforehand.
//

/// <reference path="../../node_modules/electron/electron.d.ts" />
/// <reference path="../Common.d.ts" />


function req<T = any> (module: string): T {
	return (window as any).nodeRequire(module) as T;
}

const { ipcRenderer } = req<typeof Electron>("electron");

declare global {
	// tslint:disable-next-line
	interface Window {
		send<T = void> (event: WindowEvent, ...args: any[]): Promise<T>;
		on (event: WindowEvent, callback: (...args: any[]) => any): void;
	}

	const options: Options;
	function actionBar<K extends string | number> (...actions: Action<K>[]): ActionBar<K>;

	type RequireFunction = <T = any>(module: string) => T;

	const path: typeof import("path");
	const childProcess: typeof import("mz/child_process");
	const app: Content;
}

(window as any).send = async (event: WindowEvent, ...args: any[]) => {
	return new Promise(resolve => {
		ipcRenderer.once(event, (_: any, result: any) => resolve(result));
		ipcRenderer.send(event);
	});
};

(window as any).on = (event: WindowEvent, callback: (...args: any[]) => any) => {
	ipcRenderer.on(event, callback);
};

const nodeChildProcess = req<typeof import("child_process")>("child_process");

(window as any).childProcess = {
	async exec (path: string) {
		return new Promise<[string, string]>((resolve, reject) => {
			nodeChildProcess.exec(path, (err, stdout, stderr) => {
				if (err) reject(err);
				else resolve([stdout, stderr]);
			});
		});
	},
};

(window as any).path = req("path");


////////////////////////////////////
// Initialize external dependencies for utility classes
//

import FileSystem from "util/FileSystem";
FileSystem.initialize(req<typeof import("fs")>("fs"), req<typeof import("path")>("path"));


////////////////////////////////////
// Initialize the Language
//

import Language from "util/string/Language";
Language.initialize();
(window as any).Language = Language;


////////////////////////////////////
// Initialize the options
//

import Options from "Options";
Options.initialize(req);

delete (window as any).nodeRequire;


////////////////////////////////////
// Document
//

import ActionBar, { Action } from "component/actionbar/ActionBar";
import Component from "component/Component";
import Content from "component/content/Content";
import Header from "component/header/Header";

const actionBar = new ActionBar();
(window as any).actionBar = (...actions: any[]) => {
	if (actions.length) return actionBar.setActions(...actions);
	return actionBar;
};

Component.get(document.body)
	.append(new Header())
	.append((window as any).app = new Content())
	.append(actionBar);
