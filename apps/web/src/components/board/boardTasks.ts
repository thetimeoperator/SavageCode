import * as Schema from "effect/Schema";

import { useLocalStorage } from "../../hooks/useLocalStorage";
import { randomUUID } from "../../lib/utils";

/** A planned prompt that has no thread yet. Starting it opens a draft in its project. */
export const BoardTask = Schema.Struct({
  id: Schema.String,
  environmentId: Schema.String,
  projectId: Schema.String,
  prompt: Schema.String,
  createdAt: Schema.String,
});
export type BoardTask = typeof BoardTask.Type;

const BoardTasks = Schema.Array(BoardTask);
const EMPTY: ReadonlyArray<BoardTask> = [];

export function useBoardTasks() {
  const [tasks, setTasks] = useLocalStorage("t3code:board-tasks", EMPTY, BoardTasks);
  return {
    tasks,
    addTask: (task: Omit<BoardTask, "id" | "createdAt">) =>
      setTasks((current) => [
        { ...task, id: randomUUID(), createdAt: new Date().toISOString() },
        ...current,
      ]),
    removeTask: (id: string) => setTasks((current) => current.filter((task) => task.id !== id)),
  };
}
