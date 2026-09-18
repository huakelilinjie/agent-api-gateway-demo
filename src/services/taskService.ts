import type { Task, TaskRepository } from '../domain/task.js';
import { AllowAllTaskPolicy, type TaskPolicy } from './taskPolicy.js';

export class TaskService {
  constructor(
    private readonly repository: TaskRepository,
    private readonly policy: TaskPolicy = new AllowAllTaskPolicy()
  ) {}

  async create(title: string): Promise<Task> {
    const normalized = title.trim();
    if (!normalized) throw new TaskValidationError('title must not be empty');
    if (normalized.length > 200) throw new TaskValidationError('title must be 200 characters or fewer');
    await this.policy.check(normalized);
    return this.repository.create({ title: normalized });
  }

  async get(id: string): Promise<Task> {
    const task = await this.repository.get(id);
    if (!task) throw new TaskNotFoundError(id);
    return task;
  }

  async list(): Promise<Task[]> {
    return this.repository.list();
  }

  async complete(id: string, expectedVersion?: number): Promise<Task> {
    const task = await this.repository.complete(id, expectedVersion);
    if (!task) throw new TaskNotFoundError(id);
    return task;
  }
}

export class TaskValidationError extends Error {}

export class TaskNotFoundError extends Error {
  constructor(readonly taskId: string) {
    super(`Task ${taskId} was not found`);
  }
}
