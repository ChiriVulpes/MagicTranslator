import fs from "fs-extra";

import clean from "./clean";
import install from "./install";
import sass from "./sass";
import _static from "./static";
import ts from "./ts";
import Task from "./utility/Task";

const copyNodeModules = Task("copy node modules", () => fs.copy("script/window/node_modules", "out/node_modules")
	.then(() => true).catch(() => false));

export default Task("build", task => task.series(
	clean,
	install,
	task.parallel(sass, _static),
	ts,
	copyNodeModules,
));
