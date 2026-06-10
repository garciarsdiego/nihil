import type { ServerMessage } from "../contract.js";

export type ScenarioId =
  | "happy-multi-file"
  | "edit-failure"
  | "config-change"
  | "aborted-turn"
  | "plan-mode";

export interface Scenario {
  id: ScenarioId;
  label: string;
  description: string;
  userPrompt: string;
  events: ServerMessage[];
}

const TURN = "turn-demo";

export const SCENARIOS: Scenario[] = [
  {
    id: "happy-multi-file",
    label: "Happy multi-file generation",
    description: "Writes two files, runs dev workflow, commits.",
    userPrompt: "Add a hero section and wire it in App.",
    events: [
      { type: "turn.started", turnId: TURN, messageId: "msg-1" },
      { type: "chat.delta", turnId: TURN, text: "I'll add a hero component and wire it into the app entry.\n\n" },
      {
        type: "action.open",
        turnId: TURN,
        actionId: 1,
        meta: { kind: "write", attrs: { path: "src/components/Hero.tsx", description: "Landing hero" } },
      },
      { type: "action.delta", turnId: TURN, actionId: 1, content: "export function Hero() {\n  return <section>Hello</section>;\n}\n" },
      {
        type: "action.close",
        turnId: TURN,
        actionId: 1,
        status: "applied",
        action: {
          kind: "write",
          path: "src/components/Hero.tsx",
          content: "export function Hero() {\n  return <section>Hello</section>;\n}\n",
          description: "Landing hero",
        },
      },
      {
        type: "action.open",
        turnId: TURN,
        actionId: 2,
        meta: { kind: "edit", attrs: { path: "src/App.tsx" } },
      },
      { type: "action.delta", turnId: TURN, actionId: 2, content: "<<<<<<< SEARCH\nexport default App\n=======\nimport { Hero } from './components/Hero'\n" },
      {
        type: "action.close",
        turnId: TURN,
        actionId: 2,
        status: "applied",
        action: {
          kind: "edit",
          path: "src/App.tsx",
          blocks: [{ search: "export default App", replace: "import { Hero } from './components/Hero'" }],
        },
      },
      { type: "chat.delta", turnId: TURN, text: "Done — preview should hot-reload." },
      { type: "turn.finished", turnId: TURN, outcome: "committed", commitRef: "a1b2c3d4e5f6", feedbackPending: false },
    ],
  },
  {
    id: "edit-failure",
    label: "Edit failure (EDIT_NO_MATCH)",
    description: "Search block misses; action closes failed with protocol error.",
    userPrompt: "Update the footer copy.",
    events: [
      { type: "turn.started", turnId: TURN, messageId: "msg-2" },
      { type: "chat.delta", turnId: TURN, text: "Updating the footer…\n" },
      {
        type: "action.open",
        turnId: TURN,
        actionId: 1,
        meta: { kind: "edit", attrs: { path: "src/Footer.tsx" } },
      },
      { type: "action.delta", turnId: TURN, actionId: 1, content: "<<<<<<< SEARCH\nOld footer\n" },
      {
        type: "action.close",
        turnId: TURN,
        actionId: 1,
        status: "failed",
        action: {
          kind: "edit",
          path: "src/Footer.tsx",
          blocks: [{ search: "Old footer", replace: "New footer" }],
        },
        error: {
          code: "EDIT_NO_MATCH",
          severity: "error",
          message: "SEARCH block did not match file contents",
          actionId: 1,
          path: "src/Footer.tsx",
        },
      },
      { type: "turn.finished", turnId: TURN, outcome: "no-changes", feedbackPending: true },
    ],
  },
  {
    id: "config-change",
    label: "Config change turn",
    description: "Workflow config write triggers config.changed badge.",
    userPrompt: "Add a staging workflow to nihil.config.json.",
    events: [
      { type: "turn.started", turnId: TURN, messageId: "msg-3" },
      { type: "chat.delta", turnId: TURN, text: "I'll extend your workflow config.\n" },
      {
        type: "action.open",
        turnId: TURN,
        actionId: 1,
        meta: { kind: "write", attrs: { path: "nihil.config.json" } },
      },
      { type: "action.delta", turnId: TURN, actionId: 1, content: '{\n  "workflows": { "staging": "vite build" }\n}\n' },
      {
        type: "action.close",
        turnId: TURN,
        actionId: 1,
        status: "applied",
        action: {
          kind: "write",
          path: "nihil.config.json",
          content: '{\n  "workflows": { "staging": "vite build" }\n}\n',
        },
      },
      { type: "config.changed", turnId: TURN, actionId: 1, path: "nihil.config.json" },
      { type: "turn.warning", turnId: TURN, code: "CONFIG_REVIEW", message: "Review workflow changes before running." },
      { type: "turn.finished", turnId: TURN, outcome: "committed", commitRef: "ff00aa11bb22", feedbackPending: false },
    ],
  },
  {
    id: "aborted-turn",
    label: "Aborted / rolled-back turn",
    description: "Turn finishes rolled-back after a failed delete.",
    userPrompt: "Remove the legacy API folder.",
    events: [
      { type: "turn.started", turnId: TURN, messageId: "msg-4" },
      { type: "chat.delta", turnId: TURN, text: "Removing legacy API…\n" },
      {
        type: "action.open",
        turnId: TURN,
        actionId: 1,
        meta: { kind: "delete", attrs: { path: "src/legacy-api" } },
      },
      {
        type: "action.close",
        turnId: TURN,
        actionId: 1,
        status: "failed",
        action: { kind: "delete", path: "src/legacy-api" },
        error: {
          code: "PATH_FORBIDDEN",
          severity: "error",
          message: "Path is outside allowed project roots",
          path: "src/legacy-api",
        },
      },
      { type: "turn.finished", turnId: TURN, outcome: "rolled-back", feedbackPending: false },
    ],
  },
  {
    id: "plan-mode",
    label: "Plan mode turn",
    description: "Single plan action with approve/reject affordances.",
    userPrompt: "Plan a dashboard refactor before we code.",
    events: [
      { type: "turn.started", turnId: TURN, messageId: "msg-5" },
      { type: "chat.delta", turnId: TURN, text: "Here's a proposed plan for the dashboard refactor.\n" },
      {
        type: "action.open",
        turnId: TURN,
        actionId: 1,
        meta: { kind: "plan", attrs: { title: "Dashboard refactor" } },
      },
      {
        type: "action.delta",
        turnId: TURN,
        actionId: 1,
        content: "1. Extract chart primitives\n2. Add loading skeletons\n3. Wire filters to URL state\n",
      },
      {
        type: "action.close",
        turnId: TURN,
        actionId: 1,
        status: "applied",
        action: {
          kind: "plan",
          title: "Dashboard refactor",
          body: "1. Extract chart primitives\n2. Add loading skeletons\n3. Wire filters to URL state\n",
        },
      },
      { type: "turn.finished", turnId: TURN, outcome: "no-changes", feedbackPending: true },
    ],
  },
];

export function getScenario(id: ScenarioId): Scenario {
  const scenario = SCENARIOS.find((s) => s.id === id);
  if (!scenario) throw new Error(`Unknown scenario: ${id}`);
  return scenario;
}
