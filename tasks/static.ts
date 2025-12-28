import fs from "fs-extra";
import Task from "./utility/Task";

export default Task("static", async () => {
	while (!await fs.copy("static", "out")
		.then(() => true).catch(() => false));
});
