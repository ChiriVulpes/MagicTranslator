import Component from "component/Component";
import SettingsInterrupt from "component/content/settings/SettingsInterrupt";
import Input from "component/shared/Input";
import Interrupt from "component/shared/Interrupt";
import LabelledRow from "component/shared/LabelledRow";
import Tooltip from "component/shared/Tooltip";
import MediaRoots, { RootMetadata } from "data/MediaRoots";
import { tuple } from "util/Arrays";
import { generalRandom } from "util/Random";
import Stream from "util/stream/Stream";
import { interpolate } from "util/string/Interpolator";
import Translation from "util/string/Translation";

const pathSegments = ["volume", "chapter", "page"] as (keyof RootMetadata["structure"])[];

export default class RootSettings extends SettingsInterrupt {
	private readonly pathInputs = new Map<keyof RootMetadata["structure"], Input>();
	private restoreButton?: Component;
	private changedFileStructure = false;

	public constructor (private readonly root: string) {
		super();
		this.setId("root-settings");

		const mediaRoot = MediaRoots.get(root)!;

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
			.append(Stream.of<(keyof RootMetadata["structure"])[]>("volume", "chapter", "page", "raw", "translated", "save", "capture")
				.map(pathType => new Component()
					.classes.toggle(!pathSegments.includes(pathType), "path-full")
					.append(new LabelledRow(`${pathType}-path`)
						.append(new Input()
							.attributes.set("path-type", pathType)
							.setText(() => mediaRoot.structure && mediaRoot.structure[pathType])
							.listeners.add("change", this.onPathInputChange)
							.schedule(input => this.pathInputs.set(pathType, input
								.schedule(Tooltip.register, tooltip => tooltip
									.setText(() => input.attributes.get("error")!))))))
					.append(pathSegments.includes(pathType) ? undefined : new LabelledRow("example")
						.classes.add("example")
						.append(new Component("span")
							.classes.add("file-structure-path-example")
							.setText(this.getPathExample(pathType))))));
	}

	public wasFileStructureChanged () {
		return this.changedFileStructure;
	}

	// tslint:disable cyclomatic-complexity
	@Bound private onPathInputChange (event: Event) {
		const input = Component.get<Input>(event);
		const inputText = input.getText().trim();
		const pathType = input.attributes.get<keyof RootMetadata["structure"]>("path-type");
		let error: false | string = false;
		if (pathSegments.includes(pathType)) {
			error = /#[^#]+#/.test(inputText) &&
				new Translation("path-segment-input-error").get(pathType);
		} else {
			const match = inputText.match(RegExp(`^[^{}]*?${pathSegments.map(segment => `{${segment}}`).join("[^{}]*?/[^{}]*?")}[^{}]*?$`));
			if (!match) error = new Translation("path-full-input-error").get(pathType);
		}

		if (!error) {
			const mediaRoot = MediaRoots.get(this.root)!;
			mediaRoot.structure[pathType] = inputText;
		}

		input.classes.toggle(!!error, "error");
		input.attributes.set("error", error || "");

		this.descendants(".file-structure-path-example").forEach(descendant => descendant.refreshText());
		this.updateDoneButton();

		this.changedFileStructure = true;
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

	private getPathExample (pathType: keyof RootMetadata["structure"]) {
		return () => {
			const mediaRoot = MediaRoots.get(this.root)!;
			const root = path.basename(this.root);
			const examplePath = path.join(root, interpolate(mediaRoot.structure[pathType], Stream.from(pathSegments)
				.map(segment => tuple(segment, mediaRoot.structure[segment]))
				.toObject()))
				.replace(/\\/g, "/");

			// we need to apply the "#"->number replacement twice, since the # character matches overlap each other
			return Stream.range(2)
				.fold(examplePath, current => current.replace(/[^\\]#/g, ([c]) => `${c}${generalRandom.int(10)}`));
		};
	}
}
