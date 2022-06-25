import Component from "component/Component";
import { ResolvablePromise } from "util/Async";
import IndexedMap from "util/Map";
import { Vector } from "util/math/Geometry";

export type ContextMenuHandler = (contextMenu: ContextMenu) => ContextMenu;
export interface ContextMenuRegistration {
	handler: ContextMenuHandler;
	deregistrationPromise: ResolvablePromise;
	contextMenu?: ContextMenu;
}

export default class ContextMenu extends Component {
	private static readonly registry = new IndexedMap<Component, ContextMenuRegistration>();
	private static readonly contextMenuContainer = new Component()
		.setId("context-menus")
		.appendTo(Component.get(document.body));

	public static register (handler: ContextMenuHandler): (component: Component) => void;
	public static register (component: Component, handler: ContextMenuHandler): void;
	public static register (handlerOrComponent: Component | ContextMenuHandler, handler?: ContextMenuHandler) {
		if (typeof handlerOrComponent === "function") {
			return (c: Component) => {
				ContextMenu.register(c, handlerOrComponent);
			};
		}

		const component = handlerOrComponent;

		if (ContextMenu.registry.get(component))
			ContextMenu.deregister(component);

		const registration: ContextMenuRegistration = {
			handler: handler!,
			deregistrationPromise: new ResolvablePromise(),
		};

		ContextMenu.registry.set(component, registration);

		const onDeregister = ContextMenu.onDeregister(component);
		const listenersUntil = component.listeners.until(onDeregister);
		listenersUntil.add("contextmenu", ContextMenu.show(component));

		void onDeregister.then(() => {
			if (!registration.contextMenu) return;
			registration.contextMenu.remove();
		});

		return;
	}

	public static deregister (component: Component) {
		const registration = ContextMenu.registry.get(component);
		if (!registration)
			return console.warn("Tried to deregister the context menu for an unregistered component", component);

		registration.deregistrationPromise.resolve();
	}

	private static async onDeregister (component: Component) {
		return Promise.race([
			component.event.waitFor("remove"),
			ContextMenu.registry.get(component)!.deregistrationPromise,
		]);
	}

	private static show (component: Component) {
		return (event: MouseEvent) => {
			const registration = ContextMenu.registry.get(component);
			if (!registration)
				return console.warn("Tried to show a context menu for an unregistered component");

			if (!registration.contextMenu || registration.contextMenu.isRemoved)
				registration.contextMenu = new ContextMenu();

			registration.contextMenu = registration.handler(registration.contextMenu);
			registration.contextMenu
				.setHost(component)
				.hide(true)
				.appendTo(ContextMenu.contextMenuContainer)
				.schedule(t => t.show());

			while (ContextMenu.contextMenuContainer.childCount > 10) {
				ContextMenu.contextMenuContainer.child(0)!.remove();
			}
		};
	}

	private static hide (component: Component) {
		return (event: MouseEvent | KeyboardEvent) => {
			const registration = ContextMenu.registry.get(component);
			if (!registration)
				return console.warn("Tried to hide a context menu for an unregistered component");

			if (!registration.contextMenu || registration.contextMenu.isRemoved)
				return;

			if ("button" in event && registration.contextMenu.box().intersects(Vector.get(event)))
				return;

			registration.contextMenu.hide(true);
		};
	}

	private host: Component;

	private constructor () {
		super();
		this.classes.add("context-menu");
	}

	public override show () {
		const listenUntil = Component.window.listeners.until(this.event.waitFor("hide"));
		listenUntil.add("mousedown", ContextMenu.hide(this.host));
		listenUntil.add("keydown", ContextMenu.hide(this.host));

		return super.show();
	}

	private setHost (component: Component) {
		this.host = component;
		return this;
	}
}
