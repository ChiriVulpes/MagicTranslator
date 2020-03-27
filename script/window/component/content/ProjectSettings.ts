import Component from "component/Component";
import SettingsInterrupt from "component/content/settings/SettingsInterrupt";
import Button from "component/shared/Button";
import Input from "component/shared/Input";
import Interrupt from "component/shared/Interrupt";
import LabelledRow from "component/shared/LabelledRow";
import Tooltip from "component/shared/Tooltip";
import Projects, { PagePathSegment, PagePathType, pathSegments, pathTypes, ProjectStructure } from "data/Projects";
import Options from "Options";
import { tuple } from "util/Arrays";
import { Events, IEventEmitter } from "util/EventEmitter";
import { generalRandom } from "util/Random";
import { interpolate } from "util/string/Interpolator";
import Path from "util/string/Path";
import Translation from "util/string/Translation";

interface ProjectSettingsEvents extends Events<SettingsInterrupt> {
	close (): any;
}

export default class ProjectSettings extends SettingsInterrupt {

	// @ts-ignore
	@Override public readonly event: IEventEmitter<this, ProjectSettingsEvents>;

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
					.event.subscribe("change", input => project.name = input.getText())))
			.append(new LabelledRow("external-editor")
				.append(new Button()
					.setText(() => project.externalEditorCLIPath || new Translation("use-global-setting").get())
					.event.subscribe("click", this.changeExternalEditorCLIPath)))
			.append(new Button()
				.setIcon("\uE107")
				.classes.add("warning", "float-right")
				.setText("remove")
				.event.subscribe("click", this.onRemoveProject));

		this.addSection("file-structure")
			.append(Stream.of(...pathSegments, ...pathTypes, ...["character", "thumb"] as const)
				.map(pathType => new Component()
					.classes.toggle(!PagePathSegment.is(pathType), "path-full")
					.append(new LabelledRow(`${pathType}-path`)
						.append(new Input()
							.attributes.set("path-type", pathType)
							.setText(() => project.structure && project.structure[pathType])
							.event.subscribe("change", this.onPathInputChange)
							.schedule(input => input
								.schedule(Tooltip.register, tooltip => tooltip
									.setText(() => input.attributes.get("error")!)))))
					.append(PagePathSegment.is(pathType) ? undefined : new LabelledRow("example")
						.classes.add("example")
						.append(new Component("span")
							.classes.add("file-structure-path-example")
							.setText(this.getPathExample(pathType))))));

		this.event.subscribe("remove", this.onClose);
	}

	public wasFileStructureChanged () {
		return this.changedFileStructure;
	}

	@Bound private async changeExternalEditorCLIPath (button: Button) {
		Projects.current!.externalEditorCLIPath = await Options.chooseExternalEditorCLIPath(false);
		button.refreshText();
	}

	// tslint:disable cyclomatic-complexity
	@Bound private onPathInputChange (input: Input) {
		const inputText = input.getText().trim();
		const pathType = input.attributes.get<keyof ProjectStructure>("path-type");
		let error: false | string = false;
		if (PagePathSegment.is(pathType)) {
			error = (/#[^#]+#/.test(inputText) || /[\\/]/.test(inputText)) &&
				new Translation("path-segment-input-error").get(pathType);
		} else if (PagePathType.is(pathType)) {
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
		const confirm = await Interrupt.remove(interrupt => interrupt
			.setTitle(() => new Translation("confirm-remove-project").get(Path.basename(this.root)))
			.setDescription("confirm-remove-project-description"));
		if (!confirm) return;

		this.classes.add("removed");

		Projects.delete(this.root);
		options.projectFolders.splice(options.projectFolders.indexOf(this.root), 1);

		this.restoreButton = new Button()
			.setIcon("\uE109")
			.classes.add("float-right")
			.setText("restore")
			.event.subscribe("click", this.onRestore)
			.appendTo(this.descendants(".interrupt-actions").first()!);
	}

	@Bound private async onRestore () {
		this.classes.remove("removed");
		Projects.addProject(this.root);
		options.projectFolders.push(this.root);
		this.restoreButton!.remove();
	}

	@Bound private async onClose () {
		const project = Projects.get(this.root);
		if (project) await project.load();
		this.event.emit("close");
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
