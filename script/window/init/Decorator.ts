import ApplyBound from "util/Bound";

ApplyBound();

declare global {
	function Override (inst: any, prop: string | symbol | number): void;
}
(window as any).Override = () => { };
