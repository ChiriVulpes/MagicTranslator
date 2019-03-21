import del, { Options } from "del";
import * as Gulp from "gulp";
import { Task as UndertakerTask } from "undertaker";
import { nameFunction, sleep, stringifyCall } from "./Util";

export type Tasks = (UndertakerTask | Series | Pipe)[];

export type Done = () => void;

export class Series {
	public static parallel (...parallel: Tasks) {
		return Gulp.parallel(parallel.map(Series.getTask));
	}

	private static getTask (task: UndertakerTask | Series | Pipe) {
		return task instanceof Series ? task.get() : task instanceof Pipe ? task.get() : task;
	}

	protected readonly series: UndertakerTask[] = [];
	public constructor (...parallel: Tasks) {
		this.then(...parallel);
	}

	public then (...parallel: Tasks) {
		this.series.push(Series.parallel(...parallel));
		return this;
	}

	protected get () {
		return Gulp.series(...this.series);
	}
}

export default class Task extends Series {
	private created = false;
	private readonly name: string;

	public constructor (name: string, ...parallel: Tasks) {
		super(...parallel);
		this.name = name;

		sleep(1000).then(() => {
			if (!this.created) {
				throw new Error("Task was named but not created.");
			}
		});
	}

	public create () {
		Gulp.task(this.name, this.get());
		this.created = true;
	}
}

export class Pipe {
	private pipes: (() => NodeJS.ReadWriteStream)[] = [];
	private readonly name: string;
	private readonly src: Gulp.Globs;

	public constructor (name: string, src: Gulp.Globs) {
		this.name = name;
		this.src = src;
	}

	public pipe (pipe: (() => NodeJS.ReadWriteStream) | string) {
		this.pipes.push(typeof pipe === "string" ? () => Gulp.dest(pipe) : pipe);
		return this;
	}

	public get () {
		return nameFunction(this.name, () => {
			let stream = Gulp.src(this.src);
			for (const pipe of this.pipes) {
				stream = stream.pipe(pipe());
			}

			return stream;
		});
	}
}

export function watch (watches: Gulp.Globs, ...parallel: Tasks) {
	return nameFunction(stringifyCall("watch", watches), async () => {
		Gulp.watch(watches, Series.parallel(...parallel));
	});
}

export function remove (toRemove: Gulp.Globs, options?: Options) {
	return nameFunction(stringifyCall("remove", toRemove), () => del(toRemove, options));
}

export function symlink (path: string) {
	return () => Gulp.symlink(path);
}
