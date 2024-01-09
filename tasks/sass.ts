import Task from "./utility/Task";

export default Task("sass", () =>
	Task.cli("sass", "style/index.scss", "out/style/index.css",
		"--embed-source-map",
		"--embed-sources"));
