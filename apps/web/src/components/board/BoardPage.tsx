import {
  scopedThreadKey,
  scopeProjectRef,
  scopeThreadRef,
} from "@t3tools/client-runtime/environment";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useNavigate } from "@tanstack/react-router";
import {
  AlarmClockIcon,
  ChevronDownIcon,
  FolderPlusIcon,
  MessageSquareIcon,
  SquarePenIcon,
  BellRingIcon,
  CheckIcon,
  CircleCheckIcon,
  ListTodoIcon,
  LoaderCircleIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { memo, useState, type KeyboardEvent, type ReactNode } from "react";

import { openCommandPalette } from "../../commandPaletteBus";
import { useComposerDraftStore } from "../../composerDraftStore";
import { isElectron } from "../../env";
import { useNewThreadHandler } from "../../hooks/useHandleNewThread";
import { useNowMinute } from "../../hooks/useNowMinute";
import { useThreadActions } from "../../hooks/useThreadActions";
import { cn } from "../../lib/utils";
import { useDelegatedUnderParent, useProjects, useVisibleThreadShells } from "../../state/entities";
import { buildThreadRouteParams } from "../../threadRoutes";
import type { SidebarThreadSummary } from "../../types";
import { useUiStateStore } from "../../uiStateStore";
import { ProjectFavicon } from "../ProjectFavicon";
import { RelativeTime } from "../RelativeTime";
import {
  filterSidebarV2VisibleThreads,
  resolveThreadLastVisitedAt,
  resolveThreadStatusPill,
} from "../Sidebar.logic";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SidebarInset } from "../ui/sidebar";
import { toastManager } from "../ui/toast";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import {
  boardThreadSortKey,
  resolveBoardDropAction,
  resolveBoardThreadPlacement,
  type BoardColumnId,
  type BoardThreadPlacement,
} from "./Board.logic";
import { type BoardTask, useBoardTasks } from "./boardTasks";

const DONE_LIMIT = 30;

const COLUMNS: ReadonlyArray<{
  readonly id: BoardColumnId;
  readonly title: string;
  readonly icon: typeof ListTodoIcon;
  readonly empty: string;
}> = [
  { id: "todo", title: "To do", icon: ListTodoIcon, empty: "Add a task to plan work" },
  { id: "progress", title: "In progress", icon: LoaderCircleIcon, empty: "No agents running" },
  { id: "needs", title: "Needs you", icon: BellRingIcon, empty: "Nothing is waiting on you" },
  { id: "done", title: "Done", icon: CircleCheckIcon, empty: "Drag finished work here" },
];

type BoardThreadItem = {
  readonly kind: "thread";
  readonly key: string;
  readonly thread: SidebarThreadSummary;
  readonly placement: BoardThreadPlacement;
  readonly lastVisitedAt: string | undefined;
  readonly sortKey: number;
};
type BoardTaskItem = { readonly kind: "task"; readonly key: string; readonly task: BoardTask };
type BoardItem = BoardThreadItem | BoardTaskItem;

type DragData = { readonly item: BoardItem; readonly from: BoardColumnId };

const projectKey = (environmentId: string, projectId: string) => `${environmentId}:${projectId}`;

function useBoardItems(now: string) {
  const threads = useVisibleThreadShells();
  const delegatedUnderParent = useDelegatedUnderParent();
  const localVisits = useUiStateStore((store) => store.threadLastVisitedAtById);
  const items: BoardThreadItem[] = [];
  for (const thread of filterSidebarV2VisibleThreads(threads, null, delegatedUnderParent)) {
    const key = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
    const lastVisitedAt = resolveThreadLastVisitedAt(thread.lastVisitedAt, localVisits[key]);
    const placement = resolveBoardThreadPlacement(
      { ...thread, resolvedLastVisitedAt: lastVisitedAt },
      { now },
    );
    items.push({
      kind: "thread",
      key,
      thread,
      placement,
      lastVisitedAt,
      sortKey: boardThreadSortKey(thread, placement.column),
    });
  }
  return items;
}

export function BoardPage() {
  const now = useNowMinute();
  const navigate = useNavigate();
  const projects = useProjects();
  const threadItems = useBoardItems(now);
  const { tasks, addTask, removeTask } = useBoardTasks();
  const { settleThread, unsettleThread } = useThreadActions();
  const newThread = useNewThreadHandler();
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [dragging, setDragging] = useState<DragData | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const projectsByKey = new Map(projects.map((p) => [projectKey(p.environmentId, p.id), p]));
  const visibleTasks = tasks.filter((task) =>
    projectsByKey.has(projectKey(task.environmentId, task.projectId)),
  );
  const inFilter = (environmentId: string, projectId: string) =>
    projectFilter === null || projectFilter === projectKey(environmentId, projectId);

  const boardProjectKeys = new Set([
    ...threadItems.map((item) => projectKey(item.thread.environmentId, item.thread.projectId)),
    ...visibleTasks.map((task) => projectKey(task.environmentId, task.projectId)),
  ]);
  const chipProjects = projects.filter((p) =>
    boardProjectKeys.has(projectKey(p.environmentId, p.id)),
  );

  const columnItems = (column: BoardColumnId): BoardItem[] => {
    const threads = threadItems
      .filter(
        (item) =>
          item.placement.column === column &&
          inFilter(item.thread.environmentId, item.thread.projectId),
      )
      .toSorted((a, b) => b.sortKey - a.sortKey);
    if (column !== "todo") return threads;
    const taskItems: BoardItem[] = visibleTasks
      .filter((task) => inFilter(task.environmentId, task.projectId))
      .map((task) => ({ kind: "task", key: `task:${task.id}`, task }));
    return [...taskItems, ...threads];
  };

  const openThread = (thread: SidebarThreadSummary) =>
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(thread.environmentId, thread.id)),
    });

  const reportFailure = (result: { readonly _tag: string }, title: string) => {
    if (result._tag === "Failure") toastManager.add({ type: "error", title });
  };
  const settle = async (thread: SidebarThreadSummary) =>
    reportFailure(
      await settleThread(scopeThreadRef(thread.environmentId, thread.id)),
      "Couldn't mark thread done",
    );
  const reopen = async (thread: SidebarThreadSummary) =>
    reportFailure(
      await unsettleThread(scopeThreadRef(thread.environmentId, thread.id)),
      "Couldn't reopen thread",
    );
  const assignTask = (task: BoardTask, thread: SidebarThreadSummary) => {
    const ref = scopeThreadRef(thread.environmentId, thread.id);
    useComposerDraftStore.getState().setPrompt(ref, task.prompt);
    removeTask(task.id);
    openThread(thread);
  };
  const startTask = async (task: BoardTask) => {
    const result = await newThread(
      scopeProjectRef(EnvironmentId.make(task.environmentId), ProjectId.make(task.projectId)),
      { prompt: task.prompt },
    );
    if (result === null) {
      toastManager.add({ type: "error", title: "Couldn't open a draft for this task" });
      return;
    }
    removeTask(task.id);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDragging((event.active.data.current as DragData | undefined) ?? null);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const data = event.active.data.current as DragData | undefined;
    const to = event.over?.id as BoardColumnId | undefined;
    if (!data || !to) return;
    const action = resolveBoardDropAction({ item: data.item.kind, from: data.from, to });
    if (action.kind === "none") {
      if (data.from !== to && to === "needs") {
        toastManager.add({
          type: "info",
          title: "Agents fill Needs you",
          description: "Cards land there on their own when an agent stops for you.",
        });
      }
      return;
    }
    if (action.kind === "start-task" && data.item.kind === "task") void startTask(data.item.task);
    if (action.kind === "settle" && data.item.kind === "thread") void settle(data.item.thread);
    if (action.kind === "unsettle" && data.item.kind === "thread") void reopen(data.item.thread);
  };

  const renderItem = (item: BoardItem, column: BoardColumnId) => {
    if (item.kind === "task") {
      const project = projectsByKey.get(projectKey(item.task.environmentId, item.task.projectId));
      return (
        <DraggableCard key={item.key} id={item.key} data={{ item, from: column }}>
          <TaskCard
            task={item.task}
            project={project ?? null}
            threads={threadItems
              .filter(
                (candidate) =>
                  candidate.thread.environmentId === item.task.environmentId &&
                  candidate.thread.projectId === item.task.projectId &&
                  candidate.placement.column !== "done",
              )
              .toSorted((a, b) => b.sortKey - a.sortKey)
              .map((candidate) => candidate.thread)}
            onStart={() => void startTask(item.task)}
            onAssign={(thread) => assignTask(item.task, thread)}
            onRemove={() => removeTask(item.task.id)}
          />
        </DraggableCard>
      );
    }
    const project = projectsByKey.get(projectKey(item.thread.environmentId, item.thread.projectId));
    return (
      <DraggableCard key={item.key} id={item.key} data={{ item, from: column }}>
        <ThreadCard
          thread={item.thread}
          placement={item.placement}
          lastVisitedAt={item.lastVisitedAt}
          project={project ?? null}
          onOpen={() => openThread(item.thread)}
          onSettle={() => void settle(item.thread)}
          onReopen={() => void reopen(item.thread)}
        />
      </DraggableCard>
    );
  };

  const needsCount = threadItems.filter((item) => item.placement.column === "needs").length;

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <WorkspacePageHeader electron={isElectron} className="border-b border-border">
          <span className="shrink-0 text-sm font-medium text-foreground">Board</span>
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {needsCount === 0 ? "Nothing needs you" : `${needsCount} need you`}
          </span>
          <Button
            size="compact"
            variant="outline"
            className="ml-auto shrink-0 [-webkit-app-region:no-drag]"
            aria-label="Add project"
            onClick={() => openCommandPalette({ open: "add-project" })}
          >
            <FolderPlusIcon aria-hidden />
            <span className="max-sm:hidden">Add project</span>
          </Button>
        </WorkspacePageHeader>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5 px-3 pt-3">
          <FilterChip active={projectFilter === null} onClick={() => setProjectFilter(null)}>
            All projects
          </FilterChip>
          {chipProjects.map((project) => {
            const key = projectKey(project.environmentId, project.id);
            return (
              <FilterChip
                key={key}
                active={projectFilter === key}
                onClick={() => setProjectFilter(projectFilter === key ? null : key)}
              >
                <ProjectFavicon project={project} className="size-3.5 shrink-0" />
                <span className="truncate">{project.title}</span>
              </FilterChip>
            );
          })}
        </div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="@container flex min-h-0 flex-1 flex-col">
            <div className="grid min-h-0 flex-1 snap-x snap-mandatory auto-cols-[minmax(14rem,80%)] grid-flow-col gap-2 overflow-x-auto overscroll-x-contain p-3 @2xl:snap-none @2xl:grid-flow-row @2xl:grid-cols-4">
              {COLUMNS.map((column) => {
                const items = columnItems(column.id);
                const shown = column.id === "done" ? items.slice(0, DONE_LIMIT) : items;
                const blocked = shown.filter(
                  (item) => item.kind === "thread" && item.placement.lane === "blocked",
                );
                const review = shown.filter(
                  (item) => item.kind === "thread" && item.placement.lane === "review",
                );
                return (
                  <BoardColumn
                    key={column.id}
                    column={column}
                    count={items.length}
                    dropHint={
                      dragging === null
                        ? null
                        : resolveBoardDropAction({
                            item: dragging.item.kind,
                            from: dragging.from,
                            to: column.id,
                          }).kind !== "none"
                    }
                    header={
                      column.id === "todo" ? (
                        <AddTaskForm
                          projects={
                            projectFilter === null
                              ? projects
                              : projects.filter(
                                  (p) => projectKey(p.environmentId, p.id) === projectFilter,
                                )
                          }
                          onAdd={addTask}
                        />
                      ) : null
                    }
                  >
                    {shown.length === 0 ? (
                      <p className="px-1 pt-6 text-center text-xs text-muted-foreground">
                        {column.empty}
                      </p>
                    ) : column.id === "needs" ? (
                      <>
                        <LaneLabel show={blocked.length > 0}>Blocked on you</LaneLabel>
                        {blocked.map((item) => renderItem(item, column.id))}
                        <LaneLabel show={review.length > 0}>Review</LaneLabel>
                        {review.map((item) => renderItem(item, column.id))}
                      </>
                    ) : (
                      shown.map((item) => renderItem(item, column.id))
                    )}
                    {items.length > shown.length ? (
                      <p className="px-1 py-2 text-center text-xs text-muted-foreground">
                        {items.length - shown.length} older in Settled
                      </p>
                    ) : null}
                  </BoardColumn>
                );
              })}
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {dragging ? (
              <div className="line-clamp-2 max-w-64 rotate-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-lg wrap-anywhere">
                {dragging.item.kind === "task"
                  ? dragging.item.task.prompt
                  : dragging.item.thread.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </SidebarInset>
  );
}

function FilterChip(props: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
      className={cn(
        "inline-flex h-6 max-w-48 min-w-0 items-center gap-1.5 rounded-full border px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        props.active
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {props.children}
    </button>
  );
}

function LaneLabel(props: { show: boolean; children: ReactNode }) {
  if (!props.show) return null;
  return <p className="px-1 pt-1 text-2xs text-muted-foreground">{props.children}</p>;
}

function BoardColumn(props: {
  column: (typeof COLUMNS)[number];
  count: number;
  dropHint: boolean | null;
  header: ReactNode;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: props.column.id });
  const Icon = props.column.icon;
  const calling = props.column.id === "needs" && props.count > 0;
  return (
    <section
      ref={setNodeRef}
      aria-label={props.column.title}
      className={cn(
        "flex min-h-0 min-w-0 snap-start flex-col rounded-xl border border-transparent bg-muted/40",
        props.dropHint === true && "border-dashed border-border",
        props.dropHint === true && isOver && "border-primary/50 bg-primary/5",
        props.dropHint === false && "opacity-60",
      )}
    >
      <header className="flex min-w-0 items-center gap-2 px-3 pt-3 pb-2">
        <Icon
          aria-hidden
          className={cn(
            "size-4 shrink-0",
            calling ? "text-warning-foreground" : "text-muted-foreground",
          )}
        />
        <h2
          className={cn(
            "min-w-0 truncate text-sm font-medium",
            calling ? "text-warning-foreground" : "text-foreground",
          )}
        >
          {props.column.title}
        </h2>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
          {props.count}
        </span>
      </header>
      {props.header ? <div className="px-2 pb-2">{props.header}</div> : null}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
        {props.children}
      </div>
    </section>
  );
}

function DraggableCard(props: { id: string; data: DragData; children: ReactNode }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: props.id,
    data: props.data,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role={undefined}
      tabIndex={undefined}
      className={cn("touch-none", isDragging && "opacity-40")}
    >
      {props.children}
    </div>
  );
}

const CARD_CLASS =
  "group flex w-full min-w-0 flex-col gap-1.5 rounded-lg wrap-anywhere border border-border bg-card px-3 py-2.5 text-left text-xs outline-none hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

function stopPropagation(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function ProjectLine(props: { project: EnvironmentProject | null; trailing?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
      {props.project ? <ProjectFavicon project={props.project} className="size-3" /> : null}
      <span className="truncate">{props.project?.title ?? "Unknown project"}</span>
      {props.trailing ? <span className="ml-auto shrink-0">{props.trailing}</span> : null}
    </div>
  );
}

function fallbackStatus(placement: BoardThreadPlacement) {
  if (placement.column === "done") return { label: "Settled", dotClass: "bg-muted-foreground" };
  if (placement.snoozed) return { label: "Snoozed", dotClass: "bg-muted-foreground" };
  if (placement.column === "todo") return { label: "Not started", dotClass: "bg-muted-foreground" };
  return { label: "Finished", dotClass: "bg-emerald-500 dark:bg-emerald-300/90" };
}

const ThreadCard = memo(function ThreadCard(props: {
  thread: SidebarThreadSummary;
  placement: BoardThreadPlacement;
  lastVisitedAt: string | undefined;
  project: EnvironmentProject | null;
  onOpen: () => void;
  onSettle: () => void;
  onReopen: () => void;
}) {
  const { thread, placement } = props;
  const pill =
    placement.column === "done"
      ? null
      : resolveThreadStatusPill({ thread: { ...thread, lastVisitedAt: props.lastVisitedAt } });
  const status = pill ?? {
    ...fallbackStatus(placement),
    colorClass: "text-muted-foreground",
    pulse: false,
  };
  const lastLine =
    placement.column === "progress" || placement.column === "needs"
      ? (thread.source.latestVisibleMessage?.text.split("\n").find((line) => line.trim()) ?? null)
      : null;
  const pr = thread.linkedPullRequest ?? thread.branchPullRequest ?? null;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      props.onOpen();
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      className={CARD_CLASS}
      onClick={props.onOpen}
      onKeyDown={onKeyDown}
    >
      <ProjectLine project={props.project} trailing={pr ? `#${pr.number}` : null} />
      <p className="line-clamp-2 text-sm font-medium text-foreground">{thread.title}</p>
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={cn("inline-flex min-w-0 items-center gap-1.5 text-2xs", status.colorClass)}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              status.dotClass,
              status.pulse && "motion-safe:animate-status-pulse",
            )}
          />
          <span className="truncate">{status.label}</span>
        </span>
        {placement.unread && placement.column === "needs" ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-3xs font-medium text-primary">
            New
          </span>
        ) : null}
        <span className="ml-auto shrink-0 text-2xs text-muted-foreground">
          {placement.snoozed && thread.snoozedUntil ? (
            <span className="inline-flex items-center gap-1">
              <AlarmClockIcon aria-hidden className="size-3" />
              <RelativeTime timestamp={thread.snoozedUntil} />
            </span>
          ) : (
            <RelativeTime timestamp={thread.updatedAt} />
          )}
        </span>
      </div>
      {lastLine ? (
        <p className="line-clamp-2 font-mono text-2xs text-muted-foreground">{lastLine}</p>
      ) : null}
      {placement.column === "needs" ? (
        <div className="flex flex-wrap gap-1.5 pt-0.5" onPointerDown={stopPropagation}>
          {placement.lane === "blocked" ? (
            <Button
              size="micro"
              variant="outline"
              onClick={(e) => (stopPropagation(e), props.onOpen())}
            >
              Respond
            </Button>
          ) : null}
          <Button
            size="micro"
            variant="outline"
            onClick={(e) => (stopPropagation(e), props.onSettle())}
          >
            <CheckIcon aria-hidden />
            Mark done
          </Button>
        </div>
      ) : placement.column === "done" ? (
        <div
          className="hidden flex-wrap gap-1.5 pt-0.5 group-hover:flex group-focus-within:flex"
          onPointerDown={stopPropagation}
        >
          <Button
            size="micro"
            variant="ghost-muted"
            onClick={(e) => (stopPropagation(e), props.onReopen())}
          >
            <Undo2Icon aria-hidden />
            Reopen
          </Button>
        </div>
      ) : null}
    </div>
  );
});

function TaskCard(props: {
  task: BoardTask;
  project: EnvironmentProject | null;
  threads: ReadonlyArray<SidebarThreadSummary>;
  onStart: () => void;
  onAssign: (thread: SidebarThreadSummary) => void;
  onRemove: () => void;
}) {
  return (
    <div className={cn(CARD_CLASS, "cursor-grab")}>
      <ProjectLine
        project={props.project}
        trailing={
          <Button
            size="icon-tiny"
            variant="ghost-muted"
            aria-label="Remove task"
            onPointerDown={stopPropagation}
            onClick={props.onRemove}
          >
            <XIcon />
          </Button>
        }
      />
      <p className="line-clamp-3 text-sm font-medium text-foreground">{props.task.prompt}</p>
      <div className="flex min-w-0 items-center gap-1.5" onPointerDown={stopPropagation}>
        <span className="min-w-0 truncate text-2xs text-muted-foreground">
          <RelativeTime timestamp={props.task.createdAt} />
        </span>
        <Menu>
          <MenuTrigger
            render={<Button size="micro" variant="outline" className="ml-auto shrink-0" />}
          >
            Assign
            <ChevronDownIcon aria-hidden />
          </MenuTrigger>
          <MenuPopup align="end" className="max-w-72">
            <MenuItem onClick={props.onStart}>
              <SquarePenIcon aria-hidden />
              New thread
            </MenuItem>
            {props.threads.length > 0 ? (
              <>
                <MenuSeparator />
                <MenuGroup>
                  <MenuGroupLabel>Give to a thread</MenuGroupLabel>
                  {props.threads.slice(0, 12).map((thread) => (
                    <MenuItem key={thread.id} onClick={() => props.onAssign(thread)}>
                      <MessageSquareIcon aria-hidden />
                      <span className="truncate">{thread.title}</span>
                    </MenuItem>
                  ))}
                </MenuGroup>
              </>
            ) : null}
          </MenuPopup>
        </Menu>
      </div>
    </div>
  );
}

function AddTaskForm(props: {
  projects: ReadonlyArray<EnvironmentProject>;
  onAdd: (task: { environmentId: string; projectId: string; prompt: string }) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keys = props.projects.map((p) => projectKey(p.environmentId, p.id));
  const selectedKey =
    chosenKey !== null && keys.includes(chosenKey) ? chosenKey : (keys[0] ?? null);
  const selected = props.projects.find((p) => projectKey(p.environmentId, p.id) === selectedKey);

  const submit = () => {
    const text = prompt.trim();
    if (text.length === 0) {
      setError("Describe the task first");
      return;
    }
    if (!selected) {
      setError("Add a project first");
      return;
    }
    props.onAdd({ environmentId: selected.environmentId, projectId: selected.id, prompt: text });
    setPrompt("");
    setError(null);
  };

  if (props.projects.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border px-3 py-2.5">
        <p className="text-xs text-muted-foreground">Add a project to start planning tasks.</p>
        <Button
          size="compact"
          variant="outline"
          onClick={() => openCommandPalette({ open: "add-project" })}
        >
          <FolderPlusIcon aria-hidden />
          Add project
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Input
        size="compact"
        value={prompt}
        placeholder="Add dark mode to settings"
        aria-label="New task"
        onChange={(event) => {
          setPrompt(event.target.value);
          setError(null);
        }}
      />
      <div className="flex min-w-0 items-center gap-1.5">
        <Select
          value={selectedKey ?? ""}
          onValueChange={(value) => {
            if (typeof value === "string") setChosenKey(value);
          }}
        >
          <SelectTrigger
            aria-label="Task project"
            size="compact"
            variant="ghost"
            className="min-w-0 flex-1"
          >
            <SelectValue>
              <span className="truncate">{selected?.title ?? "No projects"}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectPopup align="start" alignItemWithTrigger={false}>
            {props.projects.map((project) => {
              const key = projectKey(project.environmentId, project.id);
              return (
                <SelectItem key={key} value={key}>
                  {project.title}
                </SelectItem>
              );
            })}
          </SelectPopup>
        </Select>
        <Button size="compact" variant="outline" type="submit" className="shrink-0">
          Add
        </Button>
      </div>
      {error ? <p className="text-2xs text-destructive-foreground">{error}</p> : null}
    </form>
  );
}
