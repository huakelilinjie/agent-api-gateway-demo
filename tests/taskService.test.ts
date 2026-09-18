import { describe, expect, it } from 'vitest';
import { InMemoryTaskRepository, OptimisticLockError } from '../src/repository/inMemoryTaskRepository.js';
import { TaskService } from '../src/services/taskService.js';

describe('TaskService', () => {
  it('normalizes titles and completes with optimistic locking', async () => {
    const service = new TaskService(new InMemoryTaskRepository());
    const created = await service.create('  review gateway policy  ');

    expect(created.title).toBe('review gateway policy');
    expect(created.version).toBe(1);

    const completed = await service.complete(created.id, 1);
    expect(completed.status).toBe('completed');
    expect(completed.version).toBe(2);
  });

  it('rejects a stale expected version', async () => {
    const service = new TaskService(new InMemoryTaskRepository());
    const created = await service.create('ship safely');
    await service.complete(created.id, 1);

    await expect(service.complete(created.id, 1)).rejects.toBeInstanceOf(OptimisticLockError);
  });
});
