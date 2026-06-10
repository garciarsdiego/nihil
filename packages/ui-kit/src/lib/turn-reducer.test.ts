import { describe, expect, it } from "vitest";
import { getScenario } from "../mock/scenarios.js";
import { reduceServerMessage, reduceServerMessages, createInitialChatState } from "./turn-reducer.js";

describe("turn-reducer", () => {
  it("replays happy multi-file scenario into stream + actions", () => {
    const state = reduceServerMessages(getScenario("happy-multi-file").events);
    expect(state.turn.phase).toBe("finished");
    expect(state.turn.outcome).toBe("committed");
    expect(state.stream.filter((i) => i.type === "action")).toHaveLength(2);
    expect(state.actions.get(1)?.status).toBe("applied");
  });

  it("captures edit failure error on action card", () => {
    const state = reduceServerMessages(getScenario("edit-failure").events);
    const card = state.actions.get(1);
    expect(card?.status).toBe("failed");
    expect(card?.error?.code).toBe("EDIT_NO_MATCH");
    expect(state.turn.feedbackPending).toBe(true);
  });

  it("accumulates config.changed and warnings", () => {
    const state = reduceServerMessages(getScenario("config-change").events);
    expect(state.turn.configChanges).toHaveLength(1);
    expect(state.turn.configChanges[0]?.path).toBe("nihil.config.json");
    expect(state.turn.warnings).toHaveLength(1);
  });

  it("handles rolled-back outcome", () => {
    const state = reduceServerMessages(getScenario("aborted-turn").events);
    expect(state.turn.outcome).toBe("rolled-back");
  });

  it("resets on turn.started", () => {
    let state = reduceServerMessages(getScenario("happy-multi-file").events);
    state = reduceServerMessage(state, {
      type: "turn.started",
      turnId: "new",
      messageId: "m-new",
    });
    expect(state.prose).toBe("");
    expect(state.actions.size).toBe(0);
    expect(state.turn.phase).toBe("streaming");
  });

  it("starts idle", () => {
    const state = createInitialChatState();
    expect(state.turn.phase).toBe("idle");
  });
});
