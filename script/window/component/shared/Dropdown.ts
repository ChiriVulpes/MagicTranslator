import Component from "component/Component";
import { tuple } from "util/Arrays";
import { sleep } from "util/Async";
import Stream from "util/stream/Stream";
import Translation from "util/string/Translation";

export default class Dropdown<O> extends Component {
	public static of<A extends any[]> (...options: A) {
		return new Dropdown<A[number]>(() => options);
	}

	public static from<O> (iterable: GetterOfOr<Iterable<O>>) {
		const entries = typeof iterable === "function" ? undefined : [...iterable];
		return new Dropdown(typeof iterable === "function" ? iterable : () => entries!);
	}

	private selected: O;
	private title?: (...args: any[]) => string;
	private options: Map<O, Component>;
	private translationHandler?: (option: O) => string;
	private optionInitializer?: (option: Component, id: O) => any;
	private dropdownDirectionHandler?: (dropdown: this, wrapper: Component) => "up" | "down";
	private readonly wrapper = new Component()
		.classes.add("dropdown-wrapper")
		.hide(true)
		.appendTo(Component.body);

	private constructor (private readonly optionsGenerator: () => Iterable<O>) {
		super("button");
		this.classes.add("dropdown");

		this.refresh();

		this.listeners.add("remove", this.wrapper.remove);
		this.listeners.add("click", this.onClick);
		this.listeners.add("contextmenu", this.onContextMenu);
	}

	public getSelected () {
		return this.selected;
	}

	/**
	 * @deprecated Use `setTitle`
	 */
	@Override public setText (): this {
		throw new Error("Cannot use 'setText' on a Dropdown, see 'setTitle'");
	}

	public setTitle (translation: string | true) {
		if (translation === true) translation = "dropdown-title-default";
		this.title = translation === undefined ? undefined : new Translation(translation).get;
		this.refreshText();
		return this;
	}

	public setTranslationHandler (handler: (option: O) => string) {
		this.translationHandler = handler;
		this.refreshText();
		for (const option of this.options.values()) option.refreshText();
		return this;
	}

	public select (option: O) {
		this.close();

		if (this.selected !== option) {
			this.selected = option;
			this.emit<O>("select", event => event.data = option);
		}

		this.inheritText(this.options.get(option)!, this.title);

		return this;
	}

	public optionStream () {
		return this.options.entryStream();
	}

	public setOptionInitializer (initializer: (option: Component, id: O) => any) {
		this.optionInitializer = initializer;
		this.options.entries().forEach(([id, option]) => initializer(option, id));
		return this;
	}

	public setDropdownDirectionHandler (handler: (dropdown: this, wrapper: Component) => "up" | "down") {
		this.dropdownDirectionHandler = handler;
		return this;
	}

	private refresh () {
		this.wrapper.dump();
		const options = this.optionsGenerator();
		this.options = Stream.from(options)
			.map(option => tuple(option, new Component("button")
				.classes.add("option")
				.setDisabled()
				.setText(() => this.translationHandler ? this.translationHandler(option) :
					typeof option === "string" && Translation.exists(option) ? new Translation(option).get() :
						`${option}`)
				.listeners.add("click", this.onDropdownMemberActivate)
				.listeners.add("blur", this.onBlur)
				.schedule(button => this.optionInitializer && this.optionInitializer(button, option))
				.appendTo(this.wrapper)))
			.toMap();

		this.select(this.selected === undefined ? this.options.keyStream().first()! : this.selected);
	}

	private close () {
		if (!this.classes.has("open")) return;

		this.classes.remove("open");
		this.wrapper
			.style.set("max-height", "none")
			.hide(true)
			.children()
			.forEach(child => child.setDisabled());

		this.focus();
		this.emit("close");
	}

	@Bound private onClick () {
		const box = this.box();

		const goingUp = this.dropdownDirectionHandler ? this.dropdownDirectionHandler(this, this.wrapper) === "up"
			: box.top + box.height / 2 > window.innerHeight / 2;
		const maxHeight = (goingUp ? box.top : window.innerHeight - box.bottom) - 100;

		this.classes.add("open");

		this.refresh();

		this.wrapper
			.style.set("max-height", maxHeight)
			.style.set("width", box.width)
			.style.set("left", box.left)
			.style.set(goingUp ? "top" : "bottom", "auto")
			.style.set(goingUp ? "bottom" : "top", goingUp ? window.innerHeight - box.top : box.bottom)
			.show()
			.children()
			.forEach(child => child.setDisabled(false));

		Component.window.listeners.until(this.listeners.waitFor("close"))
			.add(["wheel", "resize", "keyup"], this.onWindowEventForClose);

		this.options.get(this.selected)!.focus();
		this.emit("open");
	}

	@Bound private onContextMenu () {
		this.refresh();
		if (this.options.get(this.selected)!.isLast()) {
			this.select(this.options.keyStream().first()!);
		} else {
			this.select(this.getOptionFromComponent(this.options.get(this.selected)!.nextSibling()!)!);
		}
	}

	@Bound private async onBlur () {
		if (this.wrapper.isHidden()) return;
		await sleep(0);
		const active = document.activeElement && Component.get(document.activeElement);
		if (!active || !active.matches(".dropdown-wrapper :scope")) {
			this.close();
		}
	}

	@Bound private onDropdownMemberActivate (event: Event) {
		const optionComponent = Component.get(event);
		this.select(this.getOptionFromComponent(optionComponent)!);
	}

	@Bound private onWindowEventForClose (event: KeyboardEvent) {
		if (event.type === "resize" || (event.type === "keyup" && event.code === "Escape")) this.close();
		else if (!Component.get(event).matches(".dropdown-wrapper, .dropdown-wrapper *")) this.close();
	}

	private getOptionFromComponent (optionComponent: Component) {
		const result = this.options.entryStream()
			.find(([, component]) => component === optionComponent);
		return result && result[0];
	}
}
