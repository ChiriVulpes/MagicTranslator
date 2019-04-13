import Component from "component/Component";
import SettingsInterrupt from "component/content/settings/SettingsInterrupt";
import Button, { ButtonDisplayMode } from "component/shared/Button";
import CheckButton from "component/shared/CheckButton";
import Dropdown from "component/shared/Dropdown";
import Interrupt from "component/shared/Interrupt";
import LabelledRow from "component/shared/LabelledRow";
import Options from "Options";
import Enums from "util/Enums";
import Translation from "util/string/Translation";

export default class GlobalSettings extends SettingsInterrupt {

	public constructor () {
		super();
		this.setId("global-settings");

		this.addSection("appearance")
			.append(new LabelledRow("custom-title-bar")
				.append(new CheckButton()
					.setChecked(options.customTitleBar)
					.setText(button => new Translation(button.isChecked() ? "enabled" : "disabled").get())
					.listeners.add("toggle", this.toggleCustomTitleBar)))
			.append(process.platform !== "win32" ? undefined : new LabelledRow("button-display-mode")
				.append(Dropdown.from(Enums.values(ButtonDisplayMode))
					.setDropdownDirectionHandler(() => "down")
					.select(options.buttonDisplayMode)
					.listeners.add("select", event => Button.setDisplayMode(Component.get<Dropdown<ButtonDisplayMode>>(event).getSelected()))));

		this.addSection("dependencies")
			.append(new LabelledRow("capture2text-path")
				.append(new Component("button")
					.setText(() => options.capture2TextCLIPath || new Translation("unset").get())
					.listeners.add("click", this.changeCapture2TextCLIPath)))
			.append(new LabelledRow("imagemagick-path")
				.append(new Component("button")
					.setText(() => options.imageMagickCLIPath || new Translation("unset").get())
					.listeners.add("click", this.changeImageMagickCLIPath)))
			.append(new LabelledRow("external-editor")
				.append(new Component("button")
					.setText(() => options.externalEditorPath || new Translation("unset").get())
					.listeners.add("click", this.changeExternalEditorPath)));
	}

	@Bound private async changeCapture2TextCLIPath (event: Event) {
		await Options.chooseCapture2TextCLIPath();
		Component.get(event).refreshText();
	}

	@Bound private async changeImageMagickCLIPath (event: Event) {
		await Options.chooseImageMagickCLIPath();
		Component.get(event).refreshText();
	}

	@Bound private async changeExternalEditorPath (event: Event) {
		await Options.chooseExternalEditorPath();
		Component.get(event).refreshText();
	}

	@Bound private async toggleCustomTitleBar (event: Event) {
		const checkButton = Component.get<CheckButton>(event);
		checkButton.refreshText();
		options.customTitleBar = checkButton.isChecked();
		if (!await Interrupt.confirm(interrupt => interrupt
			.setTitle("requires-restart")
			.setDescription("requires-restart-description"))) return;

		window.send("window-restart");
	}
}
