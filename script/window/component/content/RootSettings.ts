import Component from "component/Component";
import Input from "component/shared/Input";
import Interrupt, { InterruptChoice } from "component/shared/Interrupt";
import LabelledRow from "component/shared/LabelledRow";
import Tooltip from "component/shared/Tooltip";
import MediaRoots from "data/MediaRoots";
import Bound from "util/Bound";
import { generalRandom } from "util/Random";
import Translation from "util/string/Translation";

export default class RootSettings extends Interrupt {
	public static async show (root: string) {
		return new RootSettings(root)
			.appendTo(Component.get("#content"))
			.show()
			.listeners.waitFor("remove");
	}

	private readonly sections = new Component()
		.classes.add("sections")
		.appendTo(this.content, "beginning");

	private readonly volumePath: Input;
	private readonly chapterPath: Input;
	private readonly pagePath: Input;
	private readonly pathExample: Component;
	private restoreButton?: Component;

	public constructor (private readonly root: string) {
		super();
		this.setId("root-settings");
		this.setActions(InterruptChoice.Done);

		const mediaRoot = MediaRoots.get(root)!;

		this.pathExample = new Component("span")
			.classes.add("file-structure-path-example");

		this.addSection("main")
			.append(new LabelledRow("directory")
				.append(new Component("span")
					.setText(() => path.basename(this.root))
					.schedule(Tooltip.register, tooltip => tooltip
						.setText(() => this.root))))
			.append(new LabelledRow("name")
				.append(new Input()
					.setText(() => mediaRoot.name || "")
					.listeners.add("change", event => mediaRoot.name = Component.get<Input>(event).getText())))
			.append(new Component("button")
				.classes.add("float-right")
				.setText("remove")
				.listeners.add("click", this.onRemove));

		this.addSection("file-structure")
			.append(new LabelledRow("volume-path")
				.append(this.volumePath = new Input()
					.setText(() => mediaRoot.structure && mediaRoot.structure.volume)
					.listeners.add("change", this.pathExample.refreshText)))
			.append(new LabelledRow("chapter-path")
				.append(this.chapterPath = new Input()
					.setText(() => mediaRoot.structure && mediaRoot.structure.chapter)
					.listeners.add("change", this.pathExample.refreshText)))
			.append(new LabelledRow("page-path")
				.append(this.pagePath = new Input()
					.setText(() => mediaRoot.structure && mediaRoot.structure.page)
					.listeners.add("change", this.pathExample.refreshText)))
			.append(new LabelledRow("example")
				.append(this.pathExample
					.setText(this.getPathExample)));
	}

	@Bound
	private async onRemove () {
		const confirm = await Interrupt.confirm(interrupt => interrupt
			.setTitle(() => new Translation("confirm-remove-root").get(path.basename(this.root)))
			.setDescription("confirm-remove-root-description"));
		if (!confirm) return;

		this.classes.add("removed");

		MediaRoots.delete(this.root);
		options.rootFolders.splice(options.rootFolders.indexOf(this.root), 1);

		this.restoreButton = new Component("button")
			.classes.add("float-right")
			.setText("restore")
			.listeners.add("click", this.onRestore)
			.appendTo(this.descendants(".interrupt-actions").first()!);
	}

	@Bound
	private async onRestore () {
		this.classes.remove("removed");
		MediaRoots.addRoot(this.root);
		options.rootFolders.push(this.root);
		this.restoreButton!.remove();
	}

	private addSection (name: string) {
		return new Component("section")
			.append(new Component("h2")
				.setText(name))
			.appendTo(this.sections);
	}

	@Bound
	private getPathExample () {
		return `${path.basename(this.root)}/${this.volumePath.getText()}/${this.chapterPath.getText()}/${this.pagePath.getText()}`
			.replace(/[^\\]#/g, ([c]) => `${c}${generalRandom.int(10)}`)
			.replace(/[^\\]#/g, ([c]) => `${c}${generalRandom.int(10)}`);
	}
}
