import type { TextGenerator } from "component/Component";
import Component from "component/Component";
import WindowControls from "component/header/WindowControls";

export default class Header extends Component {

	public static setBreadcrumbs (...breadcrumbs: [TextGenerator<Component>, (() => any)?][]) {
		const title = Component.get<Header>("#header").title;
		title.dump();

		breadcrumbs.stream()
			.map(([translation, handler]) => new Component("span")
				.classes.toggle(handler !== undefined, "breadcrumb")
				.setText(translation)
				.schedule(handler && (c => c.listeners.add("click", handler))))
			.flatMap(entry => [entry, new Component("span").setText("breadcrumb-separator")])
			.forEach(component => component.appendTo(title));

		if (title.childCount) title.child(-1)!.remove();
		Header.updateTitle();
	}

	private static updateTitle () {
		document.title = Component.get<Header>("#header").title.element().textContent || "";
	}

	private readonly title = new Component()
		.classes.add("title")
		.appendTo(this);

	public constructor () {
		super();
		this.setId("header");
		new WindowControls().appendTo(this);
	}
}
