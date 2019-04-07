import Component from "component/Component";
import SettingsInterrupt from "component/content/settings/SettingsInterrupt";
import CheckButton from "component/shared/CheckButton";
import Interrupt from "component/shared/Interrupt";
import LabelledRow from "component/shared/LabelledRow";
import Options from "Options";
import Translation from "util/string/Translation";

export default class GlobalSettings extends SettingsInterrupt {

	public constructor () {
		super();
		this.setId("global-settings");

		this.addSection("main")
			.append(new CheckButton()
				.setText("custom-title-bar")
				.setChecked(options.customTitleBar)
				.listeners.add("toggle", this.toggleCustomTitleBar))
			.append(new LabelledRow("capture2text-path")
				.append(new Component("button")
					.setText(() => options.capture2TextCLIPath || new Translation("unset").get())
					.listeners.add("click", this.changeCapture2TextCLIPath)))
			.append(new LabelledRow("imagemagick-path")
				.append(new Component("button")
					.setText(() => options.imageMagickCLIPath || new Translation("unset").get())
					.listeners.add("click", this.changeImageMagickCLIPath)));
	}

	@Bound private async changeCapture2TextCLIPath (event: Event) {
		await Options.chooseCapture2TextCLIPath();
		Component.get(event).refreshText();
	}

	@Bound private async changeImageMagickCLIPath (event: Event) {
		await Options.chooseImageMagickCLIPath();
		Component.get(event).refreshText();
	}

	@Bound private async toggleCustomTitleBar (event: Event) {
		options.customTitleBar = Component.get<CheckButton>(event).isChecked();
		if (!await Interrupt.confirm(interrupt => interrupt
			.setTitle("requires-restart")
			.setDescription("requires-restart-description"))) return;

		window.send("window-restart");
	}
}
