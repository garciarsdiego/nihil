
import { describe, it, expect } from "vitest";
import { NihilStreamParser, type NihilAction, type ProtocolError } from "../index.js";

/**
 * Seeded PRNG (mulberry32) for deterministic fuzz.
 * SEED LOG: 0xFEED_C0DE (4277004510)
 */
const SEED = 0xfeedc0de;
function mulberry32(): () => number {
  let state = SEED;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32();

interface Collected {
  prose: string;
  closes: NihilAction[];
  errors: ProtocolError[];
}

function collect(text: string): Collected {
  const c: Collected = { prose: "", closes: [], errors: [] };
  const p = new NihilStreamParser({
    onProse: (_m, t) => { c.prose += t; },
    onActionClose: (_m, _id, action) => c.closes.push(action),
    onProtocolError: (_m, e) => c.errors.push(e),
  });
  p.parse("m1", text);
  p.finalize("m1", text);
  return c;
}

function deepEqual(a: Collected, b: Collected): boolean {
  if (a.prose !== b.prose) return false;
  if (a.errors.length !== b.errors.length) return false;
  for (let i = 0; i < a.errors.length; i++) {
    if (a.errors[i].code !== b.errors[i].code) return false;
    if (a.errors[i].severity !== b.errors[i].severity) return false;
  }
  if (a.closes.length !== b.closes.length) return false;
  for (let i = 0; i < a.closes.length; i++) {
    if (JSON.stringify(a.closes[i]) !== JSON.stringify(b.closes[i])) return false;
  }
  return true;
}

function randomPartition(len: number, numCuts: number): number[] {
  const cuts: number[] = [];
  for (let i = 0; i < numCuts; i++) {
    cuts.push(Math.floor(rng() * len));
  }
  cuts.sort((a, b) => a - b);
  const sizes: number[] = [];
  let prev = 0;
  for (const cut of cuts) {
    const s = cut - prev;
    if (s > 0) sizes.push(s);
    prev = cut;
  }
  const last = len - prev;
  if (last > 0) sizes.push(last);
  return sizes.length > 0 ? sizes : [len];
}

function feedChunked(text: string, chunkSizes: number[]): Collected {
  const c: Collected = { prose: "", closes: [], errors: [] };
  const p = new NihilStreamParser({
    onProse: (_m, t) => { c.prose += t; },
    onActionClose: (_m, _id, action) => c.closes.push(action),
    onProtocolError: (_m, e) => c.errors.push(e),
  });
  let acc = "";
  let pos = 0;
  for (const size of chunkSizes) {
    const end = Math.min(pos + size, text.length);
    acc = text.slice(0, end);
    p.parse("m1", acc);
    pos = end;
    if (pos >= text.length) break;
  }
  p.finalize("m1", text);
  return c;
}

const WRITE = (path: string, body: string, extra = "") =>
  '<nihil-write path="' + path + '"' + extra + '>\n' + body + '\n</nihil-write>';

const CORPUS: { name: string; text: string }[] = [
  {
    name: "plain prose",
    text: "This is just a plain prose message with no tags at all.\nJust some markdown and content.\n",
  },
  {
    name: "simple write",
    text: WRITE("src/App.tsx", 'import React from "react";\nconst App = () => <div>Hello</div>;\nexport default App;', ' description="Main app component"'),
  },
  {
    name: "prose + write + prose",
    text: 'Let me create the component for you.\n\n' + WRITE("src/Button.tsx", 'import React from "react";\nexport const Button = ({ label }: { label: string }) => (\n  <button>{label}</button>\n);') + '\n\nThat should work.',
  },
  {
    name: "two writes back to back",
    text: WRITE("src/a.ts", "export const a = 1;") + "\n" + WRITE("src/b.ts", "export const b = 2;"),
  },
  {
    name: "edit with multi-block",
    text: '<nihil-edit path="src/App.tsx">\n<<<<<<< SEARCH\nimport React from "react";\n=======\nimport React from "react";\nimport { useState } from "react";\n>>>>>>> REPLACE\n<<<<<<< SEARCH\nconst App = () => <div/>;\n=======\nconst App = () => {\n  const [count, setCount] = useState(0);\n  return <div onClick={() => setCount(c => c + 1)}>{count}</div>;\n};\n>>>>>>> REPLACE\n</nihil-edit>',
  },
  {
    name: "self-closing tags",
    text: '<nihil-rename from="src/old.tsx" to="src/new.tsx"/>\n<nihil-delete path="src/garbage.ts"/>\n<nihil-run workflow="test" args="--filter Hero"/>',
  },
  {
    name: "unknown tags mixed in",
    text: 'prose before <nihil-teleport to="mars"/> middle prose <nihil-portal>\nnarrated body skipped\n</nihil-portal> prose after',
  },
  {
    name: "plan tag",
    text: '<nihil-plan title="Add dark mode">\n1. Create ThemeContext\n2. Add toggle button\n3. Use CSS variables\n</nihil-plan>',
  },
  {
    name: "add-dependency tag",
    text: 'adding deps <nihil-add-dependency packages="zustand@^4 react-router-dom@latest jotai"/> done',
  },
  {
    name: "complex mixed message",
    text: 'Alright, I will set things up.\n\n' +
      WRITE("package.json", '{\n  "name": "my-app",\n  "dependencies": {}\n}') + '\n\n' +
      WRITE("src/main.tsx", 'import React from "react";\nconst root = React.createElement("div");') + '\n\n' +
      '<nihil-add-dependency packages="zustand@^4"/>\n\n' +
      '<nihil-rename from="src/legacy.ts" to="src/modern.ts"/>\n\nDone.',
  },
];

describe("fuzz-chunking property tests", () => {
  const SEED_LOG = "0x" + SEED.toString(16).padStart(8, "0");

  it("seed is logged: " + SEED_LOG, () => {
    expect(SEED).toBe(0xfeedc0de);
  });

  for (const { name, text } of CORPUS) {
    describe("corpus: " + name, () => {
      it("exhaustive 1-char chunking matches single-pass", () => {
        const baseline = collect(text);
        const chunked = feedChunked(text, new Array(text.length).fill(1));
        expect(deepEqual(baseline, chunked)).toBe(true);
      });

      it("200 random partitions match single-pass", () => {
        const baseline = collect(text);
        for (let i = 0; i < 200; i++) {
          const numCuts = Math.max(1, Math.floor(rng() * 12));
          const sizes = randomPartition(text.length, numCuts);
          const chunked = feedChunked(text, sizes);
          expect(
            deepEqual(baseline, chunked),
            "partition " + (i + 1) + " failed with sizes: [" + sizes.join(", ") + "]",
          ).toBe(true);
        }
      });

      it("idempotence: re-parse produces same result", () => {
        const first = collect(text);
        const second = collect(text);
        expect(deepEqual(first, second)).toBe(true);
      });
    });
  }
});
