export type TaskStatus = 'open' | 'completed';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface NewTask {
  title: string;
}

export interface TaskRepository {
  create(input: NewTask): Promise<Task>;
  get(id: string): Promise<Task | undefined>;
  list(): Promise<Task[]>;
  complete(id: string, expectedVersion?: number): Promise<Task | undefined>;
}
