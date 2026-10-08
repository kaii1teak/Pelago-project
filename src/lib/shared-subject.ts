import { useSyncExternalStore } from "react";

/**
 * The coin the visitor just picked, held so the NEXT page can pick it up: the row they
 * clicked and the asset page's header are the same logo, name and price, and
 * <ViewTransition> morphs one into the other when both carry the same name.
 *
 * Only this one coin is named on screen (the others would be 100+ snapshots for
 * nothing), and the asset page's loading skeleton draws its header from this
 * snapshot, because the real data has not arrived when the navigation starts.
 */
export type Subject = {
  id: string;
  name: string;
  symbol: string;
  image: string | null;
  price: number | null;
};

let subject: Subject | null = null;
const listeners = new Set<() => void>();

export function setSubject(next: Subject | null) {
  if (subject?.id === next?.id && subject?.price === next?.price) return;
  subject = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getSubject = () => subject;

export function useSubject(): Subject | null {
  return useSyncExternalStore(subscribe, getSubject, () => null);
}

/** Id only: a row re-renders when it becomes (or stops being) the chosen one, nothing else. */
export function useSubjectId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => subject?.id ?? null,
    () => null,
  );
}
