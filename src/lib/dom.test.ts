import { describe, expect, it } from "vitest";
import { isInert, live } from "./dom";

function list() {
  document.body.innerHTML = `
    <ul>
      <li id="a"><button>a</button></li>
      <li id="b" inert><button>b</button></li>
      <li id="c"><button>c</button></li>
    </ul>`;
  return document.querySelectorAll("button");
}

describe("isInert / live", () => {
  it("knows what is inside an inert item, however deep", () => {
    const [a, b] = list();
    expect(isInert(a!)).toBe(false);
    expect(isInert(b!)).toBe(true);
    expect(isInert(null)).toBe(false);
  });

  it("keeps only what is still really there", () => {
    expect(live(list()).map((el) => el.textContent)).toEqual(["a", "c"]);
  });
});
