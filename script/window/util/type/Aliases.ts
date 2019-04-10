type ArrayOfIterablesOr<T> = (T | Iterable<T>)[];
type GetterOfOr<T> = T | (() => T);