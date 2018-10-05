import Component from "component/Component";
import Bound from "util/Bound";

export default class WindowControls extends Component {
	private readonly maximizeButton: Component;

	public constructor() {
		super();
		this.setId("window-controls");

		new Component()
			.attributes.set("action", "minimize")
			.attributes.set("aria-label", "minimize")
			.listeners.add("click", this.minimize)
			.appendTo(this);

		this.maximizeButton = new Component()
			.attributes.set("action", "maximize")
			.attributes.set("aria-label", "maximize")
			.listeners.add("click", this.maximize)
			.appendTo(this);

		new Component()
			.attributes.set("action", "close")
			.attributes.set("aria-label", "close")
			.listeners.add("click", this.close)
			.appendTo(this);

		window.addEventListener("resize", this.onResize);
		this.onResize();
	}

	@Bound
	private minimize () {
		window.send("window-minimize");
	}

	@Bound
	private maximize () {
		const action = this.maximizeButton.attributes.get("action");
		window.send(`window-${action}` as WindowEvent);
		this.maximizeButton.attributes.set("action", action == "maximize" ? "restore" : "maximize");
	}

	@Bound
	private close () {
		window.send("window-close");
	}

	@Bound
	private async onResize () {
		const maximized = await window.send<boolean>("window-is-maximized");
		const fullscreen = await window.send<boolean>("window-is-fullscreen");
		this.maximizeButton.attributes.set("action", maximized ? "restore" : "maximize");
		Component.get(document.documentElement!).classes.toggle(maximized, "is-maximized");
		Component.get(document.documentElement!).classes.toggle(fullscreen, "is-fullscreen");
	}
}
