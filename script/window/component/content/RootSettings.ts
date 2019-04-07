import Component from "component/Component";
import Input from "component/shared/Input";
import Interrupt, { InterruptChoice } from "component/shared/Interrupt";
import LabelledRow from "component/shared/LabelledRow";
import Tooltip from "component/shared/Tooltip";
import MediaRoots, { RootMetadata } from "data/MediaRoots";
import { generalRandom } from "util/Random";
import Stream from "util/stream/Stream";
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

	private readonly pathInputs = new Map<keyof RootMetadata["structure"], Input>();
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
			.append(Stream.of<(keyof RootMetadata["structure"])[]>("volume", "chapter", "page")
				.map(pathType => new LabelledRow(`${pathType}-path`)
					.append(new Input()
						.attributes.set("path-type", pathType)
						.setText(() => mediaRoot.structure && mediaRoot.structure[pathType])
						.listeners.add("change", this.onPathInputChange)
						.schedule(input => this.pathInputs.set(pathType, input
							.schedule(Tooltip.register, tooltip => tooltip
								.setText(() => input.attributes.get("error")!)))))))
			.append(new LabelledRow("example")
				.append(this.pathExample
					.setText(this.getPathExample)));
	}

	@Bound @Override protected keyup (event: KeyboardEvent) {
		if (this.descendants(".error").first()) return;
		super.keyup(event);
	}

	@Bound private onPathInputChange (event: Event) {
		const input = Component.get<Input>(event);
		const error = /#[^#]+#/.test(input.getText());
		input.classes.toggle(error, "error");
		input.attributes.set("error", !error ? "" : new Translation("path-input-error").get(input.attributes.get("path-type")));
		this.pathExample.refreshText();
		this.updateDoneButton();
	}

	private updateDoneButton () {
		this.descendants("[action='done']")
			.first()!
			.classes.toggle(!!this.descendants(".error").first(), "disabled");
	}

	@Bound private async onRemove () {
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

	@Bound private async onRestore () {
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

	@Bound private getPathExample () {
		const root = path.basename(this.root);
		const volume = this.pathInputs.get("volume")!.getText();
		const chapter = this.pathInputs.get("chapter")!.getText();
		const page = this.pathInputs.get("page")!.getText();
		const examplePath = `${root}/${volume}/${chapter}/${page}`;
		// we need to apply the "#"->number replacement twice, since the # character matches overlap each other
		return Stream.range(2)
			.fold(examplePath, current => current.replace(/[^\\]#/g, ([c]) => `${c}${generalRandom.int(10)}`));
	}
}
