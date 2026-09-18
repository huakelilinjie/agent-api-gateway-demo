import { randomUUID } from 'node:crypto';
import type { NewTask, Task, TaskRepository } from '../domain/task.js';

export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, Task>();

  async create(input: NewTask): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      version: 1
    };
    this.tasks.set(task.id, task);
    return structuredClone(task);
  }

  async get(id: string): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    return task ? structuredClone(task) : undefined;
  }

  async list(): Promise<Task[]> {
    return [...this.tasks.values()]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(task => structuredClone(task));
  }

  async complete(id: string, expectedVersion?: number): Promise<Task | undefined> {
    const current = this.tasks.get(id);
    if (!current) return undefined;
    if (expectedVersion !== undefined && current.version !== expectedVersion) {
      throw new OptimisticLockError(id, expectedVersion, current.version);
    }
    if (current.status === 'completed') return structuredClone(current);

    const updated: Task = {
      ...current,
      status: 'completed',
      updatedAt: new Date().toISOString(),
      version: current.version + 1
    };
    this.tasks.set(id, updated);
    return structuredClone(updated);
  }
}

export class OptimisticLockError extends Error {
  constructor(
    readonly taskId: string,
    readonly expectedVersion: number,
    readonly actualVersion: number
  ) {
    super(`Task ${taskId} version mismatch: expected ${expectedVersion}, actual ${actualVersion}`);
  }
}
