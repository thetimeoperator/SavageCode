import { ProviderInstanceId, RunId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { makeThreadFixture } from "../../test-fixtures";
import {
  type BoardThreadInput,
  resolveBoardDropAction,
  resolveBoardThreadPlacement,
} from "./Board.logic";

const NOW = "2026-11-04T12:00:00.000Z";

const runtime = {
  status: "running" as const,
  activeRunId: RunId.make("run-1"),
  providerInstanceId: ProviderInstanceId.make("codex"),
  providerName: "Codex",
  lastError: null,
  updatedAt: "2026-11-04T11:59:00.000Z",
};

const finishedRun = {
  runId: RunId.make("run-1"),
  status: "completed" as const,
  requestedAt: null,
  assistantMessageId: null,
  startedAt: "2026-11-04T11:00:00.000Z",
  completedAt: "2026-11-04T11:30:00.000Z",
};

function boardThread(overrides: Partial<BoardThreadInput> = {}): BoardThreadInput {
  return {
    ...makeThreadFixture(),
    latestRun: null,
    runtime: null,
    resolvedLastVisitedAt: undefined,
    ...overrides,
  };
}

describe("resolveBoardThreadPlacement", () => {
  it.each([
    { name: "never-run thread", overrides: {}, column: "todo", lane: null },
    { name: "running agent", overrides: { runtime }, column: "progress", lane: null },
    {
      name: "pending approval",
      overrides: { runtime, hasPendingApprovals: true },
      column: "needs",
      lane: "blocked",
    },
    {
      name: "question for the user",
      overrides: { hasPendingUserInput: true },
      column: "needs",
      lane: "blocked",
    },
    {
      name: "failed run",
      overrides: { runtime: { ...runtime, status: "failed" as const } },
      column: "needs",
      lane: "blocked",
    },
    {
      name: "ready plan",
      overrides: {
        latestRun: finishedRun,
        interactionMode: "plan" as const,
        hasActionableProposedPlan: true,
      },
      column: "needs",
      lane: "blocked",
    },
    {
      name: "finished work",
      overrides: { latestRun: finishedRun },
      column: "needs",
      lane: "review",
    },
    {
      name: "settled thread, even with a question",
      overrides: { settledOverride: "settled" as const, hasPendingUserInput: true },
      column: "done",
      lane: null,
    },
  ] as const)("places a $name in $column", ({ overrides, column, lane }) => {
    const placement = resolveBoardThreadPlacement(boardThread(overrides), { now: NOW });
    expect(placement.column).toBe(column);
    expect(placement.lane).toBe(lane);
  });

  it("parks a snoozed thread in To do until it wakes or raises its hand", () => {
    const snoozed = boardThread({
      latestRun: finishedRun,
      snoozedAt: "2026-11-04T11:40:00.000Z",
      snoozedUntil: "2026-11-05T09:00:00.000Z",
    });
    expect(resolveBoardThreadPlacement(snoozed, { now: NOW })).toMatchObject({
      column: "todo",
      snoozed: true,
    });
    expect(resolveBoardThreadPlacement(snoozed, { now: "2026-11-05T09:01:00.000Z" }).column).toBe(
      "needs",
    );
    expect(
      resolveBoardThreadPlacement({ ...snoozed, hasPendingApprovals: true }, { now: NOW }).column,
    ).toBe("needs");
  });

  it("flags finished work the user has not opened since it completed", () => {
    const finished = boardThread({ latestRun: finishedRun });
    expect(
      resolveBoardThreadPlacement(
        { ...finished, resolvedLastVisitedAt: "2026-11-04T11:00:00.000Z" },
        { now: NOW },
      ).unread,
    ).toBe(true);
    expect(
      resolveBoardThreadPlacement(
        { ...finished, resolvedLastVisitedAt: "2026-11-04T11:45:00.000Z" },
        { now: NOW },
      ).unread,
    ).toBe(false);
  });
});

describe("resolveBoardDropAction", () => {
  it.each([
    { item: "thread", from: "needs", to: "done", kind: "settle" },
    { item: "thread", from: "progress", to: "done", kind: "settle" },
    { item: "thread", from: "done", to: "needs", kind: "unsettle" },
    { item: "thread", from: "done", to: "progress", kind: "unsettle" },
    { item: "thread", from: "done", to: "todo", kind: "none" },
    { item: "thread", from: "progress", to: "needs", kind: "none" },
    { item: "thread", from: "needs", to: "progress", kind: "none" },
    { item: "task", from: "todo", to: "progress", kind: "start-task" },
    { item: "task", from: "todo", to: "done", kind: "none" },
    { item: "thread", from: "done", to: "done", kind: "none" },
  ] as const)("$item from $from to $to is $kind", ({ item, from, to, kind }) => {
    expect(resolveBoardDropAction({ item, from, to }).kind).toBe(kind);
  });
});
