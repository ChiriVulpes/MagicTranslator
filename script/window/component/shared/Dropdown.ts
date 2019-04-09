import Component from "component/Component";
import { tuple } from "util/Arrays";
import { sleep } from "util/Async";
import Translation from "util/string/Translation";

export default class Dropdown<O> extends Component {
	public static of<A extends any[]> (...options: A) {
		return new Dropdown<A[number]>(...options);
	}

	public static from<O> (iterable: Iterable<O>) {
		return new Dropdown(...iterable);
	}

	private selected: O;
	private title: (...args: any[]) => string;
	private readonly options: Map<O, Component>;
	private translationHandler?: (option: O) => string;
	private readonly wrapper = new Component()
		.classes.add("dropdown-wrapper")
		.appendTo(Component.body);

	private constructor (...options: O[]) {
		super("button");
		this.classes.add("dropdown");

		this.options = options.stream()
			.map(option => tuple(option, new Component("button")
				.classes.add("option")
				.setDisabled()
				.setText(() => this.translationHandler ? this.translationHandler(option) :
					typeof option === "string" ? new Translation(option).get() :
						`${option}`)
				.listeners.add("click", this.onDropdownMemberActivate)
				.listeners.add("blur", this.onBlur)
				.appendTo(this.wrapper)))
			.toMap();

		this.setTitle("dropdown-title-default");
		this.select(options[0]);

		this.listeners.add("remove", this.wrapper.remove);
		this.listeners.add("click", this.onClick);
		this.listeners.add("contextmenu", this.onContextMenu);
	}

	public getSelected () {
		return this.selected;
	}

	@Override public setText (): this {
		throw new Error("Cannot use 'setText' on a Dropdown, see 'setTitle'");
	}

	public setTitle (translation: string) {
		this.title = new Translation(translation).get;
		return this;
	}

	public setTranslationHandler (handler: (option: O) => string) {
		this.translationHandler = handler;
		return this;
	}

	public select (option: O) {
		this.selected = option;
		this.inheritText(this.options.get(option)!, this.title);
		this.close();
		this.emit<O>("select", event => event.data = option);
		return this;
	}

	private close () {
		this.wrapper
			.style.set("max-height", "none")
			.hide(true)
			.children()
			.forEach(child => child.setDisabled());
		this.focus();
	}

	@Bound private onClick () {
		const box = this.box();

		const goingUp = box.top + box.height / 2 > window.innerHeight / 2;
		const maxHeight = goingUp ? box.top : window.innerHeight - box.bottom;

		this.wrapper
			.style.set("max-height", maxHeight)
			.style.set("min-width", box.width)
			.style.set("left", box.left)
			.style.set(goingUp ? "top" : "bottom", "auto")
			.style.set(goingUp ? "bottom" : "top", goingUp ? window.innerHeight - box.top : box.bottom)
			.show()
			.children()
			.forEach(child => child.setDisabled(false));

		this.options.get(this.selected)!.focus();
	}

	@Bound private onContextMenu () {
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

	private getOptionFromComponent (optionComponent: Component) {
		const result = this.options.entryStream()
			.find(([, component]) => component === optionComponent);
		return result && result[0];
	}
}
