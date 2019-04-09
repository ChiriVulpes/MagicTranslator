import Component from "component/Component";
import SettingsInterrupt from "component/content/settings/SettingsInterrupt";
import Input from "component/shared/Input";
import Interrupt from "component/shared/Interrupt";
import LabelledRow from "component/shared/LabelledRow";
import Tooltip from "component/shared/Tooltip";
import Projects, { PagePathSegment, pathSegments, pathTypes, ProjectStructure } from "data/Projects";
import { exact, tuple } from "util/Arrays";
import { generalRandom } from "util/Random";
import Stream from "util/stream/Stream";
import { interpolate } from "util/string/Interpolator";
import Path from "util/string/Path";
import Translation from "util/string/Translation";

export default class ProjectSettings extends SettingsInterrupt {
	private readonly pathInputs = new Map<keyof ProjectStructure, Input>();
	private restoreButton?: Component;
	private changedFileStructure = false;

	public constructor (private readonly root: string) {
		super();
		this.setId("project-settings");

		const project = Projects.get(root)!;

		this.addSection("main")
			.append(new LabelledRow("directory")
				.append(new Component("span")
					.setText(() => Path.basename(this.root))
					.schedule(Tooltip.register, tooltip => tooltip
						.setText(() => this.root))))
			.append(new LabelledRow("name")
				.append(new Input()
					.setText(() => project.name || "")
					.listeners.add("change", event => project.name = Component.get<Input>(event).getText())))
			.append(new Component("button")
				.classes.add("float-right")
				.setText("remove")
				.listeners.add("click", this.onRemoveProject));

		this.addSection("file-structure")
			.append(Stream.of(...pathSegments, ...pathTypes, exact("characters"))
				.map(pathType => new Component()
					.classes.toggle(!PagePathSegment.is(pathType), "path-full")
					.append(new LabelledRow(`${pathType}-path`)
						.append(new Input()
							.attributes.set("path-type", pathType)
							.setText(() => project.structure && project.structure[pathType])
							.listeners.add("change", this.onPathInputChange)
							.schedule(input => this.pathInputs.set(pathType, input
								.schedule(Tooltip.register, tooltip => tooltip
									.setText(() => input.attributes.get("error")!))))))
					.append(PagePathSegment.is(pathType) ? undefined : new LabelledRow("example")
						.classes.add("example")
						.append(new Component("span")
							.classes.add("file-structure-path-example")
							.setText(this.getPathExample(pathType))))));

		this.listeners.add("remove", this.onClose);
	}

	public wasFileStructureChanged () {
		return this.changedFileStructure;
	}

	// tslint:disable cyclomatic-complexity
	@Bound private onPathInputChange (event: Event) {
		const input = Component.get<Input>(event);
		const inputText = input.getText().trim();
		const pathType = input.attributes.get<keyof ProjectStructure>("path-type");
		let error: false | string = false;
		if (PagePathSegment.is(pathType)) {
			error = (/#[^#]+#/.test(inputText) || /[\\/]/.test(inputText)) &&
				new Translation("path-segment-input-error").get(pathType);
		} else {
			const match = inputText.match(RegExp(`^[^{}]*?${pathSegments.map(segment => `{${segment}}`).join("[^{}]*?/[^{}]*?")}[^{}]*?$`));
			if (!match) error = new Translation("path-full-input-error").get(pathType);
		}

		if (!error) {
			const project = Projects.get(this.root)!;
			project.structure[pathType] = inputText;
		}

		input.classes.toggle(!!error, "error");
		input.attributes.set("error", error || "");

		this.descendants(".file-structure-path-example").forEach(descendant => descendant.refreshText());
		this.updateDoneButton();

		this.changedFileStructure = true;
	}

	@Bound private async onRemoveProject () {
		const confirm = await Interrupt.confirm(interrupt => interrupt
			.setTitle(() => new Translation("confirm-remove-project").get(Path.basename(this.root)))
			.setDescription("confirm-remove-project-description"));
		if (!confirm) return;

		this.classes.add("removed");

		Projects.delete(this.root);
		options.projectFolders.splice(options.projectFolders.indexOf(this.root), 1);

		this.restoreButton = new Component("button")
			.classes.add("float-right")
			.setText("restore")
			.listeners.add("click", this.onRestore)
			.appendTo(this.descendants(".interrupt-actions").first()!);
	}

	@Bound private async onRestore () {
		this.classes.remove("removed");
		Projects.addProject(this.root);
		options.projectFolders.push(this.root);
		this.restoreButton!.remove();
	}

	@Bound private async onClose () {
		await Projects.get(this.root)!.load();
		this.emit("close");
	}

	private getPathExample (pathType: keyof ProjectStructure) {
		return () => {
			const project = Projects.get(this.root)!;
			const root = Path.basename(this.root);
			const examplePath = Path.join(root, interpolate(project.structure[pathType], Stream.from(pathSegments)
				.map(segment => tuple(segment, project.structure[segment]))
				.toObject()))
				.replace(/\\/g, "/");

			// we need to apply the "#"->number replacement twice, since the # character matches overlap each other
			return Stream.range(2)
				.fold(examplePath, current => current.replace(/[^\\]#/g, ([c]) => `${c}${generalRandom.int(10)}`));
		};
	}
}