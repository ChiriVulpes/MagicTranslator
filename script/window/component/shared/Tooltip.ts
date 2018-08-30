import Component from "component/Component";
import { ResolvablePromise } from "util/Async";
import Bound from "util/Bound";
import Map2 from "util/Map";
import { Vector } from "util/math/Geometry";

export type TooltipHandler = (tooltip: Tooltip) => Tooltip;
export interface TooltipRegistration {
	handler: TooltipHandler;
	deregistrationPromise: ResolvablePromise;
	tooltip?: Tooltip;
}

export default class Tooltip extends Component {
	private static readonly registry = new Map2<Component, TooltipRegistration>();
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

		const component = handlerOrComponent;

		if (Tooltip.registry.get(component))
			Tooltip.deregister(component);

		const tooltipRegistration: TooltipRegistration = {
			handler: handler!,
			deregistrationPromise: new ResolvablePromise(),
		};

		Tooltip.registry.set(component, tooltipRegistration);

		const onDeregister = Tooltip.onDeregister(component);
		const listenersUntil = component.listeners.until(onDeregister);
		listenersUntil.add("mouseenter", Tooltip.show(component));
		listenersUntil.add("mouseleave", Tooltip.hide(component));

		onDeregister.then(() => {
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
			component.listeners.waitFor("remove"),
			Tooltip.registry.get(component)!.deregistrationPromise,
		]);
	}

	private static show (component: Component) {
		return (event: MouseEvent) => {
			const registration = Tooltip.registry.get(component);
			if (!registration)
				return console.warn("Tried to show a tooltip for an unregistered component");

			if (!registration.tooltip || registration.tooltip.isRemoved)
				registration.tooltip = new Tooltip();

			registration.tooltip = registration.handler(registration.tooltip);
			registration.tooltip
				.setHost(component)
				.hide(true)
				.appendTo(Tooltip.tooltipContainer)
				.schedule(t => {
					t.onMouseMove(event);
					t.show();
				});

			while (Tooltip.tooltipContainer.childCount > 10) {
				Tooltip.tooltipContainer.child(0)!.remove();
			}
		};
	}

	private static hide (component: Component) {
		return () => {
			const registration = Tooltip.registry.get(component);
			if (!registration)
				return console.warn("Tried to hide a tooltip for an unregistered component");

			if (!registration.tooltip || registration.tooltip.isRemoved)
				return;

			registration.tooltip.hide(true);
		};
	}

	private host: Component;

	private constructor() {
		super();
		this.classes.add("tooltip");
	}

	public show () {
		Component.window.listeners.until(this.listeners.waitFor("hide"))
			.add("mousemove", this.onMouseMove);

		return super.show();
	}

	private setHost (component: Component) {
		this.host = component;
		return this;
	}

	@Bound
	private onMouseMove (event: MouseEvent) {
		this.style.set("--x", event.clientX);
		this.style.set("--y", event.clientY + 18);

		const box = this.box();
		this.style.set("--reverse-x", event.clientX + box.width > window.innerWidth ? 1 : 0);
		this.style.set("--reverse-y", event.clientY + 18 + box.height > window.innerHeight ? 1 : 0);

		if (!this.host.box().intersects(Vector.get(event))) {
			Tooltip.hide(this.host)();
		}
	}
}
