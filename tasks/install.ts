import Task from "./utility/Task";

export default Task("install", async () => {
	await Task.cli({ cwd: "script/window" }, "PATH:npm", "install");
});
