/** Inside something `inert`, which includes a list item that is fading out and as good as gone. */
export const isInert = (element: Element | null) => element?.closest("[inert]") != null;

/** The elements that are still really there (not on their way out). */
export const live = <T extends Element>(elements: Iterable<T>) =>
  [...elements].filter((element) => !isInert(element));
