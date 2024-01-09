import del from "del";
import Task from "./utility/Task";

export default Task("clean", () => del(["out", "dist"]));
