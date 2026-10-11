import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * What the browser downloads is every module a client component imports, and what those
 * import, and so on. A single value imported from the wrong module pulled all of zod (about
 * 380 KB of JavaScript, on every page) into the browser, to validate responses that only the
 * server ever validates. This walks that import graph from every "use client" file and fails
 * if it reaches a module that uses zod or is server-only.
 */
const SRC = path.resolve(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

const files = walk(SRC);
const source = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? path.join(SRC, spec.slice(2))
    : spec.startsWith(".")
      ? path.resolve(path.dirname(from), spec)
      : null;
  if (!base) return null;
  return (
    [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      path.join(base, "index.ts"),
      path.join(base, "index.tsx"),
    ].find((candidate) => source.has(candidate)) ?? null
  );
}

/** Runtime imports only: `import type` and `export type` are erased and cost nothing. */
function runtimeImports(file: string): { spec: string; target: string | null }[] {
  const text = source.get(file)!;
  const found: { spec: string; target: string | null }[] = [];
  const pattern =
    /(?:^|\n)\s*(?:import|export)\s+(?!type\b)([^;]*?)\s+from\s+["']([^"']+)["']/g;
  for (const match of text.matchAll(pattern)) {
    const clause = match[1]!;
    // `import { type A, type B } from`: nothing of it exists at runtime.
    const names = clause
      .replace(/[{}]/g, "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length > 0 && names.every((n) => n.startsWith("type "))) continue;
    found.push({ spec: match[2]!, target: resolve(file, match[2]!) });
  }
  for (const match of text.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) {
    found.push({ spec: match[1]!, target: resolve(file, match[1]!) });
  }
  return found;
}

const isClient = (file: string) =>
  /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(source.get(file)!);
const rel = (file: string) => path.relative(SRC, file);

/** Every module the browser gets, with the first client file that brings it in. */
function reachableFromClient() {
  const via = new Map<string, string>();
  const queue = files.filter(isClient);
  for (const f of queue) via.set(f, f);
  for (let i = 0; i < queue.length; i++) {
    const file = queue[i]!;
    for (const { target } of runtimeImports(file)) {
      if (target && !via.has(target)) {
        via.set(target, via.get(file)!);
        queue.push(target);
      }
    }
  }
  return via;
}

describe("what the browser downloads", () => {
  const reached = reachableFromClient();

  it("walks the real import graph (there is a lot in it, and the palette is in it)", () => {
    expect(reached.size).toBeGreaterThan(80);
    expect([...reached.keys()].map(rel)).toContain(
      "components/command/command-palette.tsx",
    );
  });

  it("never includes zod: responses are validated on the server", () => {
    const withZod = [...reached.keys()].filter((f) =>
      runtimeImports(f).some(({ spec }) => spec === "zod"),
    );
    expect(
      withZod.map((f) => `${rel(f)} (brought in by ${rel(reached.get(f)!)})`),
    ).toEqual([]);
  });

  it("never includes a module that is only for the server", () => {
    const serverOnly = [...reached.keys()].filter(
      (f) =>
        /import\s+["']server-only["']/.test(source.get(f)!) ||
        runtimeImports(f).some(({ spec }) => spec === "server-only"),
    );
    expect(
      serverOnly.map((f) => `${rel(f)} (brought in by ${rel(reached.get(f)!)})`),
    ).toEqual([]);
  });

  it("is caught when a client file reaches for the schemas for a value (the mistake that shipped zod)", () => {
    const schemas = path.join(SRC, "lib/api/schemas.ts");
    expect(runtimeImports(schemas).some(({ spec }) => spec === "zod")).toBe(true);
    expect(reached.has(schemas)).toBe(false);
  });
});
