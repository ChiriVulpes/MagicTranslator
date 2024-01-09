import actions from "@actions/core";
import { build, Platform } from "electron-builder";
import fs from "fs-extra";
import clean from "./clean";
import sass from "./sass";
import _static from "./static";
import ts from "./ts";
import Env from "./utility/Env";
import Task from "./utility/Task";

const copyNodeModules = Task("copy node modules", () => fs.copy("script/window/node_modules", "out")
	.then(() => true).catch(() => false));

interface VersionObject {
	version: string;
	commit: string;
}

let versionObject: VersionObject | undefined;

export default Task("bundle", task => task.series(
	clean,
	ts,
	sass,
	_static,
	copyNodeModules,

	Task("version", async () => {
		const FETCH_HEAD = (await fs.readFile(".git/FETCH_HEAD", "utf8"))?.slice(0, 7);
		if (!FETCH_HEAD)
			throw new Error("Could not find commit hash");

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const packageVersion = JSON.parse(await fs.readFile("static/package.json", "utf8") ?? "{}").version as string | undefined;
		if (!packageVersion)
			throw new Error("Could not find package version");

		await fs.writeFile("out/version", JSON.stringify(versionObject = {
			version: packageVersion,
			commit: FETCH_HEAD,
		}));

		actions.setOutput("version", versionObject.version);
		actions.setOutput("commit", versionObject.commit);
		actions.setOutput("name", `${versionObject.version}-${versionObject.commit}`);
	}),

	Task("build", async () => {

		const platforms = [];
		if (Env.MAGIC_TRANSLATOR_BUILD_WINDOWS)
			platforms.push(Platform.WINDOWS);
		if (Env.MAGIC_TRANSLATOR_BUILD_LINUX)
			platforms.push(Platform.LINUX);
		if (Env.MAGIC_TRANSLATOR_BUILD_MACOS)
			platforms.push(Platform.MAC);
		if (!platforms.length) {
			console.warn("No platforms to build electron for. To build electron, make a .env file and set one or more of:\n    MAGIC_TRANSLATOR_BUILD_WINDOWS=true\n    MAGIC_TRANSLATOR_BUILD_LINUX=true\n    MAGIC_TRANSLATOR_BUILD_MACOS=true");
			return;
		}

		console.log("Building for:", platforms.map(platform => platform.name).join(", "));

		return build({
			targets: new Map(platforms
				.flatMap(platform => [...platform.createTarget().entries()])),
			config: {
				appId: "chirivulpes.magictranslator",
				productName: "MagicTranslator",
				copyright: `Copyright © ${new Date().getFullYear()} Chiri Vulpes`,
				directories: {
					app: "out",
				},
				win: {
					target: ["portable", "zip"],
				},
				mac: {
					target: [
						{
							target: "dmg",
							arch: ["universal"],
						},
						{
							target: "zip",
							arch: ["universal"],
						},
					],
				},
				linux: {
					target: ["AppImage", "zip"],
				},
				includeSubNodeModules: true,
				buildVersion: `${versionObject!.version}-${versionObject!.commit}`,
			},
			publish: "never",
		});
	}),
));
