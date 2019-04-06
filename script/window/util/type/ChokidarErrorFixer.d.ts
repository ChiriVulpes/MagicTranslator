/*!
 * This file exists exclusively to fix some extraordinarily dumb error caused by the following conditions:
 * 1. Having Gulp installed in a folder.
 * 2. Having an AMD-compilation TypeScript project in a subfolder.
 *
 * What I guess is going on is that Gulp requires a module called "chokidar", which only works in CommonJS, not AMD,
 * due to the way that imports differ between the module compilation modes.
 *
 * And for some reason TypeScript really thinks I want to use that gulp file in this project.
 * And I couldn't figure out a way to get TypeScript to ignore it.
 *
 * So as a result, the next easiest solution is just to declare the missing types manually. 🤓
 */

declare module "chokidar" {
	export interface WatchOptions { }
}
