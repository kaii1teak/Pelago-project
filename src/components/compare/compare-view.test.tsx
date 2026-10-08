import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as CompareStore from "@/stores/compare";
import {
  COMPARE_STORAGE_KEY,
  useCompareHydrated,
  useCompareStore,
} from "@/stores/compare";
import { makeCoin } from "@/test/fixtures";
import {
  installHistoryMock,
  navigateExternally,
  uninstallHistoryMock,
} from "@/test/navigation";
import { renderWithClient } from "@/test/render";
import { CompareView } from "./compare-view";

vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationMock,
);

// Stand-in for the dynamically imported canvas: expose what it was handed.
vi.mock("next/dynamic", () => ({
  default: () =>
    function MockCanvas(props: {
      view: string;
      range: string;
      series: { id: string; color: number; points: { value: number }[] }[];
    }) {
      return (
        <div
          data-testid="canvas"
          data-range={props.range}
          data-view={props.view}
          data-series={props.series.map((s) => `${s.id}:${s.color}`).join(",")}
          data-last={props.series.map((s) => s.points.at(-1)!.value.toFixed(1)).join(",")}
        />
      );
    },
}));

// Lets one test pretend the saved selection has not been read yet.
vi.mock("@/stores/compare", async (importOriginal) => {
  const actual = await importOriginal<typeof CompareStore>();
  return { ...actual, useCompareHydrated: vi.fn(actual.useCompareHydrated) };
});
const actualHydrated = (await vi.importActual<typeof CompareStore>("@/stores/compare"))
  .useCompareHydrated;

const T0 = 1_000_000;
const COINS = ["bitcoin", "ethereum", "solana", "cardano", "dogecoin"].map((id, i) =>
  makeCoin({
    id,
    name: id[0]!.toUpperCase() + id.slice(1),
    symbol: id.slice(0, 3).toUpperCase(),
    rank: i + 1,
    price: 1000 - i * 100,
  }),
);

/** price points per coin: bitcoin +20%, ethereum -20%, solana +50% over the range */
const SERIES: Record<string, [number, number][]> = {
  bitcoin: [
    [T0, 100],
    [T0 + 100_000, 110],
    [T0 + 200_000, 120],
  ],
  ethereum: [
    [T0, 50],
    [T0 + 100_000, 45],
    [T0 + 200_000, 40],
  ],
  solana: [
    [T0, 10],
    [T0 + 100_000, 12],
    [T0 + 200_000, 15],
  ],
  cardano: [
    [T0, 2],
    [T0 + 100_000, 2],
    [T0 + 200_000, 2],
  ],
  dogecoin: [
    [T0, 1],
    [T0 + 100_000, 1],
    [T0 + 200_000, 2],
  ],
};
const asPoints = (rows: [number, number][]) =>
  rows.map(([time, value]) => ({ time, value }));

type Behaviour = "fail" | "notfound" | "pending" | [number, number][];
let charts: Record<string, Behaviour> = {};

const errorResponse = (code: string, status: number) =>
  new Response(JSON.stringify({ error: { code, message: "x" } }), { status });

function api() {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input), "http://test");
    if (url.pathname === "/api/markets") {
      const ids = url.searchParams.get("ids");
      const list = ids ? COINS.filter((c) => ids.split(",").includes(c.id)) : COINS;
      return new Response(JSON.stringify(list));
    }
    const match = url.pathname.match(/^\/api\/coins\/([^/]+)\/chart$/);
    if (match) {
      const id = match[1]!;
      const behaviour = charts[id] ?? SERIES[id];
      if (behaviour === "pending") return new Promise<Response>(() => {});
      if (behaviour === "fail") return errorResponse("upstream_error", 502);
      if (behaviour === "notfound" || !behaviour) return errorResponse("not_found", 404);
      return new Response(JSON.stringify(asPoints(behaviour)));
    }
    return errorResponse("not_found", 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const urlsOf = (mock: ReturnType<typeof api>, prefix: string) =>
  mock.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith(prefix));

/** Saves a selection the way a previous visit would have, then reads it back. */
async function savedSelection(ids: string[]) {
  localStorage.setItem(
    COMPARE_STORAGE_KEY,
    JSON.stringify({ state: { ids }, version: 1 }),
  );
  await act(async () => {
    await useCompareStore.persist.rehydrate();
  });
}

const canvas = () => screen.findByTestId("canvas");

beforeEach(() => {
  localStorage.clear();
  useCompareStore.setState({ ids: [], colors: {} });
  window.history.replaceState(null, "", "/compare");
  installHistoryMock();
  charts = {};
  vi.mocked(useCompareHydrated).mockImplementation(actualHydrated);
});
afterEach(() => {
  uninstallHistoryMock();
  vi.unstubAllGlobals();
});

describe("CompareView: before and without a selection", () => {
  it("waits for the saved selection instead of flashing the empty state", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    vi.mocked(useCompareHydrated).mockReturnValue(false);
    renderWithClient(<CompareView />);
    expect(screen.getByRole("status", { name: "Loading the comparison" })).toBeVisible();
    expect(screen.queryByText("Pick assets to compare")).toBeNull();
  });

  it("invites you to pick, asks the API for no charts, and offers a quick start", async () => {
    const fetchMock = api();
    await savedSelection([]);
    renderWithClient(<CompareView />);

    expect(await screen.findByText("Pick assets to compare")).toBeVisible();
    expect(urlsOf(fetchMock, "/api/coins")).toEqual([]);
    expect(screen.queryByRole("table")).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "Try Bitcoin vs Ethereum" }),
    );
    expect(useCompareStore.getState().ids).toEqual(["bitcoin", "ethereum"]);
    expect((await canvas()).dataset.series).toBe("bitcoin:0,ethereum:7");
  });

  it("asks for a second asset when there is only one", async () => {
    api();
    await savedSelection(["bitcoin"]);
    renderWithClient(<CompareView />);
    expect(await canvas()).toBeVisible();
    expect(screen.getByText("Add another asset to compare it against.")).toBeVisible();
  });
});

describe("CompareView: comparing", () => {
  it("draws each asset as percent change from a shared start, its own color each", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum", "solana"]);
    renderWithClient(<CompareView />);

    const el = await canvas();
    expect(el.dataset.series).toBe("bitcoin:0,ethereum:7,solana:3");
    expect(el.dataset.last).toBe("20.0,-20.0,50.0");
    expect(el.dataset.range).toBe("7d");
  });

  it("describes the chart for screen readers, with the same numbers", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    await canvas();
    expect(
      screen.getByRole("img", {
        name: "Percent change over 7 days. Bitcoin +20.00%, Ethereum -20.00%.",
      }),
    ).toBeVisible();
  });

  it("shows how each asset did on its chip, and the figures side by side", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    await canvas();

    const chips = within(screen.getByRole("list", { name: "Assets being compared" }));
    expect(chips.getByText("+20.00%")).toBeVisible();
    expect(chips.getByText("-20.00%")).toBeVisible();

    const table = await screen.findByRole("table");
    expect(within(table).getByRole("link", { name: /Bitcoin/ })).toBeVisible();
    expect(within(table).getByRole("link", { name: /Ethereum/ })).toBeVisible();
    expect(within(table).getByText("#1")).toBeVisible();
  });

  it("makes one request for the figures and one chart request per asset", async () => {
    const fetchMock = api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    await canvas();
    await screen.findByRole("table");

    expect(urlsOf(fetchMock, "/api/markets?ids=")).toEqual([
      "/api/markets?ids=bitcoin%2Cethereum",
    ]);
    expect(urlsOf(fetchMock, "/api/coins").sort()).toEqual([
      "/api/coins/bitcoin/chart?range=7d",
      "/api/coins/ethereum/chart?range=7d",
    ]);
  });

  it("switches range: requests that range for every asset and records it in the URL", async () => {
    const fetchMock = api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    await canvas();

    await userEvent.click(screen.getByRole("tab", { name: "30D" }));
    await waitFor(() =>
      expect(
        urlsOf(fetchMock, "/api/coins")
          .filter((u) => u.endsWith("30d"))
          .sort(),
      ).toEqual([
        "/api/coins/bitcoin/chart?range=30d",
        "/api/coins/ethereum/chart?range=30d",
      ]),
    );
    expect(window.location.search).toBe("?assets=bitcoin,ethereum&range=30d");
    expect((await canvas()).dataset.range).toBe("30d");
    expect(screen.getByRole("img")).toHaveAccessibleName(/over 30 days/);
  });

  it("says when one asset's history starts later, and that every line starts there", async () => {
    charts = {
      ethereum: [
        [T0 + 150_000, 50],
        [T0 + 200_000, 55],
      ],
    };
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    await canvas();
    expect(
      screen.getByText(/Ethereum only has data since .*, so every line starts there\./),
    ).toBeVisible();
  });
});

describe("CompareView: choosing assets", () => {
  it("adds an asset from the search box: one new chart request, the URL and the saved list follow", async () => {
    const fetchMock = api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    await canvas();
    const before = urlsOf(fetchMock, "/api/coins").length;

    await userEvent.click(
      screen.getByRole("combobox", { name: "Add an asset to compare" }),
    );
    await userEvent.click(await screen.findByRole("option", { name: /Solana/ }));

    await waitFor(() =>
      expect(screen.getByTestId("canvas").dataset.series).toBe(
        "bitcoin:0,ethereum:7,solana:3",
      ),
    );
    expect(useCompareStore.getState().ids).toEqual(["bitcoin", "ethereum", "solana"]);
    expect(window.location.search).toBe("?assets=bitcoin,ethereum,solana");
    expect(urlsOf(fetchMock, "/api/coins")).toHaveLength(before + 1);
    expect(screen.getByRole("status", { name: "" })).toBeDefined();
    expect(screen.getByText("Added Solana. Comparing 3 assets.")).toBeInTheDocument();
  });

  it("does not offer assets that are already in the comparison", async () => {
    api();
    await savedSelection(["bitcoin"]);
    renderWithClient(<CompareView />);
    await canvas();
    await userEvent.click(screen.getByRole("combobox"));
    const option = await screen.findByRole("option", { name: /Ethereum/ });
    await waitFor(() => expect(option).toBeVisible()); // the popup fades in
    expect(screen.queryByRole("option", { name: /Bitcoin/ })).toBeNull();
  });

  it("stops at four, and says so", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum", "solana", "cardano"]);
    renderWithClient(<CompareView />);
    await canvas();
    const box = screen.getByRole("combobox");
    expect(box).toHaveAttribute("readonly");
    expect(box).toHaveAccessibleDescription(/up to 4 assets/i);
  });

  it("removes an asset instantly, without asking the API for anything, and updates the URL", async () => {
    const fetchMock = api();
    await savedSelection(["bitcoin", "ethereum", "solana"]);
    renderWithClient(<CompareView />);
    await canvas();
    await screen.findByRole("table");
    const requests = fetchMock.mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: "Remove Ethereum" }));

    await waitFor(() =>
      expect(screen.getByTestId("canvas").dataset.series).toBe("bitcoin:0,solana:3"),
    );
    expect(useCompareStore.getState().ids).toEqual(["bitcoin", "solana"]);
    expect(window.location.search).toBe("?assets=bitcoin,solana");
    expect(fetchMock.mock.calls.length).toBe(requests);
    expect(screen.getByText("Removed Ethereum.")).toBeInTheDocument();
  });

  it("hands focus to the next chip's remove button, then to the search box", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    await canvas();

    screen.getByRole("button", { name: "Remove Bitcoin" }).focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove Ethereum" })).toHaveFocus(),
    );

    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Add an asset to compare" }),
      ).toHaveFocus(),
    );
    expect(screen.getByText("Pick assets to compare")).toBeVisible();
  });
});

describe("CompareView: line colors", () => {
  it("gives each asset a different default color", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum", "solana"]);
    renderWithClient(<CompareView />);
    const colors = (await canvas()).dataset
      .series!.split(",")
      .map((x) => x.split(":")[1]);
    expect(new Set(colors).size).toBe(3);
  });

  it("changes a line's color from its chip, on the chart and in the saved list", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    await canvas();

    await userEvent.click(screen.getByRole("button", { name: /Color of Bitcoin/ }));
    await userEvent.click(screen.getByRole("radio", { name: "Magenta" }));

    await waitFor(() =>
      expect(screen.getByTestId("canvas").dataset.series).toBe("bitcoin:5,ethereum:7"),
    );
    expect(useCompareStore.getState().colors.bitcoin).toBe(5);
    expect(
      JSON.parse(localStorage.getItem(COMPARE_STORAGE_KEY)!).state.colors.bitcoin,
    ).toBe(5);
  });

  it("swaps with the asset that already has the chosen color, so two lines never look alike", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    await canvas();

    await userEvent.click(screen.getByRole("button", { name: /Color of Bitcoin/ }));
    await userEvent.click(screen.getByRole("radio", { name: "Cyan" })); // ethereum's
    await waitFor(() =>
      expect(screen.getByTestId("canvas").dataset.series).toBe("bitcoin:7,ethereum:0"),
    );
  });

  it("keeps a chosen color when other assets come and go", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum", "solana"]);
    renderWithClient(<CompareView />);
    await canvas();
    await userEvent.click(screen.getByRole("button", { name: /Color of Solana/ }));
    await userEvent.click(screen.getByRole("radio", { name: "Green" }));

    await userEvent.click(screen.getByRole("button", { name: "Remove Bitcoin" }));
    await waitFor(() =>
      expect(screen.getByTestId("canvas").dataset.series).toBe("ethereum:7,solana:9"),
    );
  });

  it("remembers the choice after a reload", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    const first = renderWithClient(<CompareView />);
    await canvas();
    await userEvent.click(screen.getByRole("button", { name: /Color of Ethereum/ }));
    await userEvent.click(screen.getByRole("radio", { name: "Pink" }));
    first.unmount();

    // A reload: memory is empty, but what was saved is still in storage.
    const saved = localStorage.getItem(COMPARE_STORAGE_KEY)!;
    useCompareStore.setState({ ids: [], colors: {} });
    localStorage.setItem(COMPARE_STORAGE_KEY, saved);
    await act(async () => {
      await useCompareStore.persist.rehydrate();
    });
    renderWithClient(<CompareView />);
    expect((await canvas()).dataset.series).toBe("bitcoin:0,ethereum:1");
  });
});

describe("CompareView: percent or price", () => {
  it("shows percent change by default, every line starting at 0%", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    const el = await canvas();
    expect(el.dataset.view).toBe("change");
    expect(el.dataset.last).toBe("20.0,-20.0");
    expect(screen.getByText(/every line begins at 0%/)).toBeVisible();
    expect(screen.getByRole("button", { name: "% change" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("switches to the real prices, from the same shared start, and records it in the URL", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    await canvas();

    await userEvent.click(screen.getByRole("button", { name: "Price" }));
    const el = await canvas();
    expect(el.dataset.view).toBe("price");
    expect(el.dataset.last).toBe("120.0,40.0"); // the last prices, not percentages
    expect(window.location.search).toBe("?assets=bitcoin,ethereum&view=price");
    expect(screen.getByText(/logarithmic scale/)).toBeVisible();
  });

  it("goes back to percent change, and leaves the URL clean again", async () => {
    api();
    window.history.replaceState(null, "", "/compare?assets=bitcoin,ethereum&view=price");
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    expect((await canvas()).dataset.view).toBe("price");

    await userEvent.click(screen.getByRole("button", { name: "% change" }));
    expect((await canvas()).dataset.view).toBe("change");
    expect(window.location.search).toBe("?assets=bitcoin,ethereum");
  });

  it("keeps the view when the range or the assets change", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    await canvas();
    await userEvent.click(screen.getByRole("button", { name: "Price" }));
    await userEvent.click(screen.getByRole("tab", { name: "30D" }));
    await waitFor(() =>
      expect(window.location.search).toBe(
        "?assets=bitcoin,ethereum&view=price&range=30d",
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove Ethereum" }));
    await waitFor(() =>
      expect(window.location.search).toBe("?assets=bitcoin&view=price&range=30d"),
    );
    expect((await canvas()).dataset.view).toBe("price");
  });

  it("describes the price view for screen readers", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    await canvas();
    await userEvent.click(screen.getByRole("button", { name: "Price" }));
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /^Prices over 7 days, on a logarithmic scale\./,
    );
  });
});

describe("CompareView: the link and the saved selection agree", () => {
  it("writes the saved selection into the address bar", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    await canvas();
    expect(window.location.search).toBe("?assets=bitcoin,ethereum");
  });

  it("lets a link that names assets win over the saved selection", async () => {
    api();
    window.history.replaceState(null, "", "/compare?assets=ethereum,solana");
    await savedSelection(["bitcoin"]);
    renderWithClient(<CompareView />);

    await waitFor(() =>
      expect(useCompareStore.getState().ids).toEqual(["ethereum", "solana"]),
    );
    expect((await canvas()).dataset.series).toBe("ethereum:0,solana:7");
    expect(window.location.search).toBe("?assets=ethereum,solana");
  });

  it("keeps the range from the link", async () => {
    api();
    window.history.replaceState(null, "", "/compare?range=1y&assets=bitcoin,ethereum");
    await savedSelection([]);
    renderWithClient(<CompareView />);
    expect((await canvas()).dataset.range).toBe("1y");
    expect(window.location.search).toBe("?assets=bitcoin,ethereum&range=1y");
  });

  it("ignores junk in the link: bad ids dropped, at most four kept", async () => {
    api();
    window.history.replaceState(
      null,
      "",
      "/compare?assets=bitcoin,../etc,ethereum,solana,cardano,dogecoin",
    );
    await savedSelection([]);
    renderWithClient(<CompareView />);
    await waitFor(() =>
      expect(useCompareStore.getState().ids).toEqual([
        "bitcoin",
        "ethereum",
        "solana",
        "cardano",
      ]),
    );
  });

  it("follows a link opened while the page is showing (e.g. from the header)", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    await canvas();

    act(() => navigateExternally("/compare?assets=solana,cardano"));
    await waitFor(() =>
      expect(useCompareStore.getState().ids).toEqual(["solana", "cardano"]),
    );

    // ...and a bare /compare puts the saved selection back in the URL.
    act(() => navigateExternally("/compare"));
    await waitFor(() => expect(window.location.search).toBe("?assets=solana,cardano"));
  });
});

describe("CompareView: when data fails", () => {
  it("keeps the assets that loaded on the chart, and gives the failed one a retry", async () => {
    charts = { ethereum: "fail" };
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);

    expect((await canvas()).dataset.series).toBe("bitcoin:0");
    const retry = screen.getByRole("button", { name: "Retry" });

    charts = {}; // the next try succeeds
    await userEvent.click(retry);
    await waitFor(() =>
      expect(screen.getByTestId("canvas").dataset.series).toBe("bitcoin:0,ethereum:7"),
    );
  });

  it("flags an asset that does not exist, but still lets you remove it", async () => {
    charts = { ethereum: "notfound" };
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    await canvas();

    expect(screen.getByText("Not found")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Remove Ethereum" }));
    expect(useCompareStore.getState().ids).toEqual(["bitcoin"]);
  });

  it("shows one error with a retry when every chart failed", async () => {
    charts = { bitcoin: "fail", ethereum: "fail" };
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);

    expect(await screen.findByText("Couldn't load the chart")).toBeVisible();
    expect(screen.queryByTestId("canvas")).toBeNull();

    charts = {};
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect((await canvas()).dataset.series).toBe("bitcoin:0,ethereum:7");
  });

  it("holds a skeleton while the charts load", async () => {
    charts = { bitcoin: "pending", ethereum: "pending" };
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    expect(
      await screen.findByRole("status", { name: "Loading the chart" }),
    ).toBeVisible();
  });

  it("keeps a sequential heading outline under the page's h1", async () => {
    api();
    await savedSelection(["bitcoin", "ethereum"]);
    renderWithClient(<CompareView />);
    await canvas();
    await screen.findByRole("table");
    const levels = screen.getAllByRole("heading").map((h) => Number(h.tagName[1]));
    expect(levels.every((l) => l === 2)).toBe(true); // the page itself supplies the h1
  });
});
