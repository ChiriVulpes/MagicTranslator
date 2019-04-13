import Component, { TextGenerator } from "component/Component";
import WindowControls from "component/header/WindowControls";

export default class Header extends Component {
	public static setTitle (title: TextGenerator<null>) {
		Component.get<Header>("#header")
			.title.setText(title as any);
		document.title = TextGenerator.resolve(title);
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
