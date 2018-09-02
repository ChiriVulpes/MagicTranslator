import Component from "component/Component";
import WindowControls from "component/header/WindowControls";
import Translation from "util/string/Translation";

export default class Header extends Component {
	public static setTitle (title: string | Translation<string> | (() => string | number)) {
		Component.get<Header>("#header")
			.title.setText(title);
	}

	private readonly title: Component;

	public constructor() {
		super();

		this.setId("header");
		this.title = new Component().classes.add("title").appendTo(this);
		new WindowControls().appendTo(this);
	}
}
