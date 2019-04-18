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
					.event.subscribe("toggle", this.toggleCustomTitleBar)))
			.append(process.platform !== "win32" ? undefined : new LabelledRow("button-display-mode")
				.append(Dropdown.from(Enums.values(ButtonDisplayMode))
					.setDropdownDirectionHandler(() => "down")
					.select(options.buttonDisplayMode)
					.event.subscribe("select", (d, selected) => Button.setDisplayMode(selected))));

		this.addSection("dependencies")
			.append(new LabelledRow("capture2text-path")
				.append(new Button()
					.setText(() => options.capture2TextCLIPath || new Translation("unset").get())
					.event.subscribe("click", this.changeCapture2TextCLIPath)))
			.append(new LabelledRow("imagemagick-path")
				.append(new Button()
					.setText(() => options.imageMagickCLIPath || new Translation("unset").get())
					.event.subscribe("click", this.changeImageMagickCLIPath)))
			.append(new LabelledRow("external-editor")
				.append(new Button()
					.setText(() => options.externalEditorCLIPath || new Translation("unset").get())
					.event.subscribe("click", this.changeExternalEditorCLIPath)))
			.append(new LabelledRow("glosser")
				.append(new Button()
					.setText(() => options.glosserCLIPath || new Translation("jisho").get())
					.event.subscribe("click", this.changeGlosserCLIPath)));
	}

	@Bound private async changeCapture2TextCLIPath (button: Button) {
		await Options.chooseCapture2TextCLIPath();
		button.refreshText();
	}

	@Bound private async changeImageMagickCLIPath (button: Button) {
		await Options.chooseImageMagickCLIPath();
		button.refreshText();
	}

	@Bound private async changeExternalEditorCLIPath (button: Button) {
		await Options.chooseExternalEditorCLIPath();
		button.refreshText();
	}

	@Bound private async changeGlosserCLIPath (button: Button) {
		const useCustomGlosser = await Interrupt.confirm(interrupt => interrupt
			.setTitle("confirm-use-custom-glosser")
			.setDescription("confirm-use-custom-glosser-description"));

		if (!useCustomGlosser) options.glosserCLIPath = "";
		else await Options.chooseGlosserCLIPath();

		button.refreshText();
	}

	@Bound private async toggleCustomTitleBar (checkButton: CheckButton) {
		checkButton.refreshText();
		options.customTitleBar = checkButton.isChecked();
		if (!await Interrupt.confirm(interrupt => interrupt
			.setTitle("requires-restart")
			.setDescription("requires-restart-description"))) return;

		window.send("window-restart");
	}
}
