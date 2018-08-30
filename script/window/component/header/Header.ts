import Component from "component/Component";
import WindowControls from "./WindowControls";

export default class Header extends Component {
	public constructor() {
		super();

		this.setId("header");
		new WindowControls().appendTo(this);
	}
}
