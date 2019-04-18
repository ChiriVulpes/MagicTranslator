////////////////////////////////////
// Functions
//

type AnyFunction = (...args: any[]) => any;
type NullaryFunction<O = any> = () => O;
type UnaryFunction<I = any, O = any> = (input: I) => O;
type ReturnTypeOrT<T> = T extends (...args: any[]) => infer R ? R : T;
type FunctionOrNoParams<H extends AnyFunction> = H | (() => ReturnType<H>);

/**
 * Gets the arguments tuple of a function.
 */
type ArgumentsOf<F extends AnyFunction | Class<any>> =
	F extends (...args: infer A) => any ? A :
	F extends new (...args: infer A) => any ? A :
	[];


////////////////////////////////////
// Classes
//

type NullaryClass<T> = new () => T;
type Class<T> = new (...args: any[]) => T;
// tslint:disable-next-line ban-types No other type will work here except "Function"
type AnyClass<T> = (Function & { prototype: T });
type InstanceOf<T extends Class<any> | AnyClass<any>> = T extends Class<any> ? InstanceType<T> : T extends { prototype: infer P } ? P : never;


////////////////////////////////////
// Iterables
//

type ArrayOfIterablesOr<T> = (T | Iterable<T>)[];

type IterableOr<T> = T | Iterable<T>;
type ArrayOr<T> = T | T[];

type GetterOfOr<T> = T | (() => T);


////////////////////////////////////
// Tuples
//

type Head<T extends any[]> = T[0];
type Tail<A extends any[]> = ((...args: A) => any) extends ((_: any, ...args: infer A2) => any) ? A2 : never;

type AddHead<H, A extends any[]> = ArgumentsOf<(arg1: H, ...args: A) => any>;
