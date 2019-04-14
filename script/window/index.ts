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
		// on (event: WindowEvent, callback: (...args: any[]) => any): void;
	}

	const options: Options;

	type RequireFunction = <T = any>(module: string) => T;

	const app: Content;
}

(window as any).send = async (event: WindowEvent, ...args: any[]) => {
	return new Promise(resolve => {
		ipcRenderer.once(event, (_: any, result: any) => resolve(result));
		ipcRenderer.send(event);
	});
};

// (window as any).on = (event: WindowEvent, callback: (...args: any[]) => any) => {
// 	ipcRenderer.on(event, callback);
// };


////////////////////////////////////
// Initialize external dependencies for utility classes
//

const fs = req<typeof import("fs")>("fs");
const path = req<typeof import("path")>("path");
const childProcess = req<typeof import("child_process")>("child_process");
const jishoApi = req<typeof import("unofficial-jisho-api").default>("unofficial-jisho-api");

import FileSystem from "util/FileSystem";
FileSystem.initialize(fs, path);

import ChildProcess from "util/ChildProcess";
ChildProcess.initialize(childProcess);

import Path from "util/string/Path";
Path.initialize(path);

import Gloss from "util/api/Gloss";
Gloss.initialize(jishoApi);
(window as any).Gloss = Gloss;


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
Options.initialize(req)
	.then(() => {
		Component.document.classes.toggle(options.customTitleBar, "custom-title-bar");
		Component.document.attributes.set("platform", process.platform);
	});

delete (window as any).nodeRequire;


////////////////////////////////////
// Document
//

import Component from "component/Component";
import Content from "component/content/Content";
import Header from "component/header/Header";

Component.get(document.body)
	.append(new Header())
	.append((window as any).app = new Content());
