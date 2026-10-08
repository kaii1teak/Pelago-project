import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentRow, moveRow, openRow, toggleRowWatch } from "./rows";

const ROW_HEIGHT = 64;

function table(count = 4) {
  document.body.innerHTML = `<table><tbody>${Array.from(
    { length: count },
    (_, i) => `<tr data-hotkey-row tabindex="-1" data-i="${i}" id="r${i}">
      <td><button aria-pressed="false" aria-label="Watch ${i}">★</button></td>
      <td><a href="/coin/c${i}">Coin ${i}</a></td></tr>`,
  ).join("")}</tbody></table>`;
  return [...document.querySelectorAll<HTMLElement>("tr")];
}

beforeEach(() => {
  // jsdom has no layout: row i sits at y = i * 64 in a 600px-high window.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const i = Number(this.closest<HTMLElement>("[data-i]")?.dataset.i ?? 0);
    const top = i * ROW_HEIGHT;
    return { top, bottom: top + ROW_HEIGHT, width: 400, height: ROW_HEIGHT } as DOMRect;
  });
  Object.defineProperty(window, "innerHeight", { value: 600, configurable: true });
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("moveRow", () => {
  it("does nothing, and says so, when there are no rows", () => {
    document.body.innerHTML = "<p>nothing here</p>";
    expect(moveRow(1)).toBe(false);
  });

  it("starts at the first row on screen going down, and the last going up", () => {
    const rows = table(4);
    expect(moveRow(1)).toBe(true);
    expect(document.activeElement).toBe(rows[0]);
    (document.activeElement as HTMLElement).blur();
    expect(moveRow(-1)).toBe(true);
    expect(document.activeElement).toBe(rows[3]);
  });

  it("starts from what is actually on screen, not from the top of the page", () => {
    const rows = table(20); // rows 10+ are below a 600px window
    moveRow(-1);
    expect(document.activeElement).toBe(rows[9]);
  });

  it("moves one row at a time and stops at the ends", () => {
    const rows = table(3);
    moveRow(1);
    moveRow(1);
    expect(document.activeElement).toBe(rows[1]);
    moveRow(1);
    moveRow(1);
    moveRow(1);
    expect(document.activeElement).toBe(rows[2]);
    moveRow(-1);
    moveRow(-1);
    moveRow(-1);
    expect(document.activeElement).toBe(rows[0]);
  });

  it("continues from a link or button inside a row", () => {
    const rows = table(3);
    rows[1]!.querySelector("a")!.focus();
    moveRow(1);
    expect(document.activeElement).toBe(rows[2]);
  });

  it("skips a row that is on its way out", () => {
    const rows = table(3);
    rows[1]!.setAttribute("inert", "");
    moveRow(1);
    moveRow(1);
    expect(document.activeElement).toBe(rows[2]);
  });

  it("scrolls the row into view without jumping", () => {
    const rows = table(3);
    const scroll = vi.spyOn(rows[0]!, "scrollIntoView");
    moveRow(1);
    expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
  });
});

describe("currentRow", () => {
  it("is the row holding focus, or null", () => {
    const rows = table(2);
    expect(currentRow()).toBeNull();
    rows[1]!.querySelector("button")!.focus();
    expect(currentRow()).toBe(rows[1]);
  });
});

describe("openRow", () => {
  it("follows the selected row's link", () => {
    const rows = table(2);
    const click = vi.fn((e: Event) => e.preventDefault());
    rows[1]!.querySelector("a")!.addEventListener("click", click);
    rows[1]!.focus();
    expect(openRow()).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("leaves Enter alone when the focus is on something inside the row (a button, a link)", () => {
    const rows = table(2);
    rows[0]!.querySelector("button")!.focus();
    expect(openRow()).toBe(false);
  });

  it("does nothing when no row is selected", () => {
    table(2);
    expect(openRow()).toBe(false);
  });
});

describe("toggleRowWatch", () => {
  it("presses the selected row's star", () => {
    const rows = table(2);
    const star = rows[1]!.querySelector("button")!;
    const click = vi.fn();
    star.addEventListener("click", click);
    rows[1]!.focus();
    expect(toggleRowWatch()).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no row is selected", () => {
    table(2);
    expect(toggleRowWatch()).toBe(false);
  });
});
