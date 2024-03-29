import clean from "./clean";
import install from "./install";
import sass from "./sass";
import _static from "./static";
import ts from "./ts";
import Task from "./utility/Task";

export default Task("build", task => task.series(
	clean,
	install,
	task.parallel(sass, _static),
	ts,
));
