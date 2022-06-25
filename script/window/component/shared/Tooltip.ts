import Component from "component/Component";
import { ResolvablePromise } from "util/Async";
import IndexedMap from "util/Map";
import { Vector } from "util/math/Geometry";

export type TooltipHandler = (tooltip: Tooltip) => Tooltip;
export interface TooltipRegistration {
	handler: TooltipHandler;
	deregistrationPromise: ResolvablePromise;
	tooltip?: Tooltip;
}

export default class Tooltip extends Component {
	private static readonly registry = new IndexedMap<Component, TooltipRegistration>();
	private static readonly tooltipContainer = new Component()
		.setId("tooltips")
		.appendTo(Component.get(document.body));

	public static register (handler: TooltipHandler): (component: Component) => void;
	public static register (component: Component, handler: TooltipHandler): void;
	public static register (handlerOrComponent: Component | TooltipHandler, handler?: TooltipHandler) {
		if (typeof handlerOrComponent === "function") {
			return (c: Component) => {
				Tooltip.register(c, handlerOrComponent);
			};
		}

		if (!Tooltip.registry.size)
			Component.window.listeners.add("mousemove", Tooltip.onMouseMove);

		const component = handlerOrComponent;

		if (Tooltip.registry.get(component))
			Tooltip.deregister(component);

		const tooltipRegistration: TooltipRegistration = {
			handler: handler!,
			deregistrationPromise: new ResolvablePromise(),
		};

		Tooltip.registry.set(component, tooltipRegistration);

		void Tooltip.onDeregister(component).then(() => {
			Tooltip.registry.delete(component);
			if (!tooltipRegistration.tooltip) return;
			tooltipRegistration.tooltip.remove();
		});

		return;
	}

	public static deregister (component: Component) {
		const registration = Tooltip.registry.get(component);
		if (!registration)
			return console.warn("Tried to deregister the tooltip for an unregistered component", component);

		registration.deregistrationPromise.resolve();
	}

	private static async onDeregister (component: Component) {
		return Promise.race([
			component.event.waitFor("remove"),
			Tooltip.registry.get(component)!.deregistrationPromise,
		]);
	}

	private static show (component: Component, event: MouseEvent) {
		const registration = Tooltip.registry.get(component);
		if (!registration)
			return console.warn("Tried to show a tooltip for an unregistered component");

		Tooltip.tooltipContainer.dump();

		registration.tooltip = registration.handler(new Tooltip())
			.hide(true)
			.appendTo(Tooltip.tooltipContainer)
			.onMouseMove(event)
			.schedule(0, tooltip => tooltip.show());
	}

	private static hide (component: Component) {
		const registration = Tooltip.registry.get(component);
		if (!registration)
			return console.warn("Tried to hide a tooltip for an unregistered component");

		if (!registration.tooltip || registration.tooltip.isRemoved)
			return;

		// registration.tooltip.hide(true);
		registration.tooltip.remove();
		delete registration.tooltip;
	}

	private static onMouseMove (event: MouseEvent) {
		for (const [component, registration] of Tooltip.registry.entries()) {
			const intersects = component.box().intersects(Vector.get(event));
			if (intersects) {
				if (!registration.tooltip) Tooltip.show(component, event);
				else registration.tooltip.onMouseMove(event);
			} else {
				if (registration.tooltip) Tooltip.hide(component);
			}
		}
	}

	private constructor () {
		super();
		this.classes.add("tooltip");
	}

	@Bound private onMouseMove (event: MouseEvent) {
		this.style.set("--x", event.clientX);
		this.style.set("--y", event.clientY + 18);

		const box = this.box();
		this.style.set("--reverse-x", event.clientX + box.width > window.innerWidth ? 1 : 0);
		this.style.set("--reverse-y", event.clientY + 18 + box.height > window.innerHeight ? 1 : 0);

		return this;
	}
}
