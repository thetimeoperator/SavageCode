import { effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";

import type { SidebarThreadSummary } from "../../types";
import { hasUnseenCompletion, resolveSidebarThreadStatus } from "../Sidebar.logic";

export type BoardColumnId = "todo" | "progress" | "needs" | "done";

/** Needs-you cards split into work the agent is stalled on and finished work to check. */
export type BoardLane = "blocked" | "review" | null;

export type BoardThreadPlacement = {
  readonly column: BoardColumnId;
  readonly lane: BoardLane;
  readonly unread: boolean;
  readonly snoozed: boolean;
};

export type BoardThreadInput = SidebarThreadSummary & {
  readonly resolvedLastVisitedAt: string | undefined;
};

export function resolveBoardThreadPlacement(
  thread: BoardThreadInput,
  options: { readonly now: string },
): BoardThreadPlacement {
  const unread = hasUnseenCompletion({ ...thread, lastVisitedAt: thread.resolvedLastVisitedAt });
  const place = (column: BoardColumnId, lane: BoardLane = null, snoozed = false) => ({
    column,
    lane,
    unread,
    snoozed,
  });
  if (thread.settledOverride === "settled") return place("done");
  if (effectiveSnoozed(thread, options)) return place("todo", null, true);

  switch (resolveSidebarThreadStatus(thread)) {
    case "approval":
    case "input":
    case "request":
    case "failed":
    case "limited":
      return place("needs", "blocked");
    case "working":
    case "waiting":
      return place("progress");
    case "ready":
      if (thread.latestRun === null) return place("todo");
      if (thread.interactionMode === "plan" && thread.hasActionableProposedPlan) {
        return place("needs", "blocked");
      }
      return place("needs", "review");
  }
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Newest activity first; within Done, most recently settled first. */
export function boardThreadSortKey(
  thread: Pick<
    SidebarThreadSummary,
    "settledAt" | "updatedAt" | "latestUserMessageAt" | "runtime" | "latestRun"
  >,
  column: BoardColumnId,
): number {
  if (column === "done") return timestamp(thread.settledAt ?? thread.updatedAt);
  if (column === "progress") {
    return timestamp(thread.runtime?.activityStartedAt ?? thread.latestUserMessageAt);
  }
  return Math.max(
    timestamp(thread.latestRun?.completedAt),
    timestamp(thread.runtime?.updatedAt),
    timestamp(thread.latestUserMessageAt),
  );
}

export type BoardDropAction =
  | { readonly kind: "settle" }
  | { readonly kind: "unsettle" }
  | { readonly kind: "start-task" }
  | { readonly kind: "none" };

/**
 * Agents own placement everywhere except Done: users can settle a thread or bring it
 * back, and start a planned task. Needs-you only fills itself.
 */
export function resolveBoardDropAction(input: {
  readonly item: "thread" | "task";
  readonly from: BoardColumnId;
  readonly to: BoardColumnId;
}): BoardDropAction {
  const { item, from, to } = input;
  if (from === to) return { kind: "none" };
  if (item === "task") return to === "progress" ? { kind: "start-task" } : { kind: "none" };
  if (to === "done") return { kind: "settle" };
  if (from === "done" && to !== "todo") return { kind: "unsettle" };
  return { kind: "none" };
}
