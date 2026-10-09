import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from '../app/services/http'
import { internalKanbanService } from '../app/services/internal-kanban'
import {
  dropIndex,
  groupByStatus,
  moveTask,
} from '../app/utils/internal-kanban'
import type { KanbanStatus, KanbanTask } from '../app/types/internal-kanban'

afterEach(() => vi.unstubAllGlobals())

function task(id: string, status: KanbanStatus, position: number): KanbanTask {
  return {
    id,
    title: `Tarefa ${id}`,
    description: null,
    status,
    position,
    created_at: '2026-10-05T00:00:00+00:00',
    updated_at: '2026-10-05T00:00:00+00:00',
  }
}
const board = [
  task('1', 'TODO', 0),
  task('2', 'TODO', 1),
  task('3', 'TODO', 2),
  task('4', 'DONE', 0),
]
const ids = (tasks: KanbanTask[], status: KanbanStatus) =>
  groupByStatus(tasks)[status].map((item) => item.id)

describe('internal kanban local move', () => {
  it('reorders inside a column with dense positions and without losing tasks', () => {
    const moved = moveTask(board, '3', 'TODO', 0)!
    expect(ids(moved, 'TODO')).toEqual(['3', '1', '2'])
    expect(moved.map((item) => item.position)).toEqual([0, 1, 2, 0])
    expect(moved).toHaveLength(board.length)
    expect(board[2]!.position).toBe(2)
  })
  it('moves across columns and compacts the origin', () => {
    const moved = moveTask(board, '1', 'DONE', 1)!
    expect(ids(moved, 'TODO')).toEqual(['2', '3'])
    expect(ids(moved, 'DONE')).toEqual(['4', '1'])
    expect(moved.find((item) => item.id === '1')?.status).toBe('DONE')
  })
  it('refuses no-ops, unknown tasks and positions outside the column', () => {
    expect(moveTask(board, '2', 'TODO', 1)).toBeUndefined()
    expect(moveTask(board, '9', 'DONE', 0)).toBeUndefined()
    expect(moveTask(board, '1', 'DONE', 2)).toBeUndefined()
    expect(moveTask(board, '1', 'DONE', -1)).toBeUndefined()
    expect(moveTask(board, '1', 'IN_REVIEW', 1)).toBeUndefined()
  })
  it('computes the drop index from the pointer and card middles', () => {
    expect(dropIndex(10, [50, 150])).toBe(0)
    expect(dropIndex(100, [50, 150])).toBe(1)
    expect(dropIndex(300, [50, 150])).toBe(2)
    expect(dropIndex(5, [])).toBe(0)
  })
})

describe('internal kanban HTTP contract', () => {
  it('sends the CSRF header on PATCH, DELETE and move, with credentials and no organization', async () => {
    vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=abc%3D' })
    const fetchStub = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchStub)
    const service = internalKanbanService(
      createApiClient('http://localhost:8000'),
    )
    await service.update('7', { title: 'T', description: null })
    await service.remove('7')
    await service.move('7', 'DONE', 0)
    await service.create({ title: 'T', description: null })
    const calls = fetchStub.mock.calls as [string, RequestInit][]
    expect(calls.map(([url, init]) => [init.method, url])).toEqual([
      ['PATCH', 'http://localhost:8000/api/v1/internal/kanban/tasks/7'],
      ['DELETE', 'http://localhost:8000/api/v1/internal/kanban/tasks/7'],
      ['POST', 'http://localhost:8000/api/v1/internal/kanban/tasks/7/move'],
      ['POST', 'http://localhost:8000/api/v1/internal/kanban/tasks'],
    ])
    for (const [, init] of calls) {
      const headers = init.headers as Record<string, string>
      expect(init.credentials).toBe('include')
      expect(headers['X-XSRF-TOKEN']).toBe('abc=')
      expect(headers['X-Organization-Id']).toBeUndefined()
    }
    expect(JSON.parse(calls[2]![1].body as string)).toEqual({
      status: 'DONE',
      position: 0,
    })
  })
})
