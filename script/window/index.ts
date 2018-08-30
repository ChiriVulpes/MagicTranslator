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

	const fs: typeof import("mz/fs");
	const childProcess: typeof import("mz/child_process");
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

const nodefs = req<typeof import("fs")>("fs");
const nodeChildProcess = req<typeof import("child_process")>("child_process");

(window as any).fs = {
	async readdir (dir: string) {
		return new Promise<string[]>((resolve, reject) => {
			nodefs.readdir(dir, (err: NodeJS.ErrnoException | undefined, files) => {
				if (err) reject(err);
				else resolve(files);
			});
		});
	},
	async readFile (path: string, encoding: string) {
		return new Promise<string>((resolve, reject) => {
			nodefs.readFile(path, encoding, (err: NodeJS.ErrnoException | undefined, file) => {
				if (err) reject(err);
				else resolve(file);
			});
		});
	},
	async exists (path: string) {
		return new Promise<boolean>((resolve, reject) => {
			nodefs.stat(path, (err: NodeJS.ErrnoException | undefined, stats) => {
				resolve(!err);
			});
		});
	},
	async writeFile (path: string, data: string | Buffer) {
		return new Promise((resolve, reject) => {
			nodefs.writeFile(path, data, err => {
				if (err) reject(err);
				resolve();
			});
		});
	},
	async mkdir (path: string) {
		return new Promise((resolve, reject) => {
			nodefs.mkdir(path, err => {
				if (err && err.code !== "EEXIST") reject(err);
				resolve();
			});
		});
	},
};

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


////////////////////////////////////
// Initialize the options
//

import Options from "util/Options";
Options.initialize(req);



////////////////////////////////////
// Initialize external dependencies for File classes
//


delete (window as any).nodeRequire;

////////////////////////////////////
// Initialize IterableIterator support
//

import IterableIterator = require("util/IterableIterator");
IterableIterator.pipe();

////////////////////////////////////
// Initialize the Language
//

import Language from "util/string/Language";
Language.initialize();
(window as any).Language = Language;


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
	.append(new Content())
	.append(actionBar);
