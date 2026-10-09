import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const roots: string[] = []
const runGit = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' })
const initialize = (cwd: string) => {
  mkdirSync(cwd, { recursive: true })
  runGit(cwd, 'init', '--quiet')
  runGit(cwd, 'config', 'user.name', 'Migration Test')
  runGit(cwd, 'config', 'user.email', 'migration@test.invalid')
}
const entry = {
  id: 'migration-test-change',
  occurredAt: '2026-10-09T12:00:00.000Z',
  agent: 'Teste',
  summary: 'Registro de teste.',
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'pingofin-split-test-'))
  roots.push(root)
  const front = join(root, 'pingo-front-crm'),
    back = join(root, 'pingo-back-crm')
  initialize(front)
  initialize(back)
  for (const directory of ['scripts', 'shared/utils', 'data'])
    mkdirSync(join(front, directory), { recursive: true })
  copyFileSync(
    resolve('scripts/check-external-agent-change.mjs'),
    join(front, 'scripts/check-external-agent-change.mjs'),
  )
  copyFileSync(
    resolve('shared/utils/agent-changes.ts'),
    join(front, 'shared/utils/agent-changes.ts'),
  )
  writeFileSync(
    join(front, 'data/agent-changes.json'),
    JSON.stringify({
      schemaVersion: 1,
      changes: [entry, { ...entry, id: 'unused-old-change' }],
      details: [],
    }),
  )
  runGit(front, 'add', '.')
  runGit(front, 'commit', '--quiet', '-m', 'History fixture')
  const commit = runGit(front, 'rev-parse', 'HEAD').trim()
  const reference = {
    changeId: entry.id,
    frontRepository: 'pingo-front-crm',
    frontCommit: commit,
  }
  const save = () =>
    writeFileSync(join(back, '.agent-change.json'), JSON.stringify(reference))
  writeFileSync(join(back, 'change.txt'), 'Changed')
  runGit(back, 'add', 'change.txt')
  const check = () =>
    spawnSync(
      process.execPath,
      [join(front, 'scripts/check-external-agent-change.mjs')],
      { cwd: back, encoding: 'utf8' },
    )
  return { back, front, reference, save, check }
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    if (!root.startsWith(join(tmpdir(), 'pingofin-split-test-')))
      throw new Error('Unexpected cleanup target')
    rmSync(root, { recursive: true, force: true })
  }
})
describe('private history across repositories', () => {
  it('rejects an older unused entry instead of a new frontend record', () => {
    const test = fixture()
    test.save()
    runGit(test.back, 'add', '.agent-change.json')
    runGit(test.back, 'commit', '--quiet', '-m', 'Reference fixture')
    test.reference.changeId = 'unused-old-change'
    test.save()
    runGit(test.back, 'add', '.agent-change.json')
    expect(test.check().stderr).toContain('nova desde')
  }, 15000)

  it('requires a staged reference to a committed frontend record', () => {
    const test = fixture()
    expect(test.check().status).toBe(1)
    test.save()
    expect(test.check().status).toBe(1)
    runGit(test.back, 'add', '.agent-change.json')
    expect(test.check().status).toBe(0)
  }, 15000)
  it('rejects a nonexistent record and checks the index instead of the repaired worktree', () => {
    const test = fixture()
    test.reference.changeId = 'missing-change'
    test.save()
    runGit(test.back, 'add', '.agent-change.json')
    test.reference.changeId = entry.id
    test.save()
    expect(test.check().stderr).toContain('ID não encontrado')
  }, 15000)
  it('rejects reusing a record in another commit', () => {
    const test = fixture()
    test.save()
    runGit(test.back, 'add', '.agent-change.json')
    runGit(test.back, 'commit', '--quiet', '-m', 'Reference fixture')
    writeFileSync(join(test.back, 'change.txt'), 'Another change')
    runGit(test.back, 'add', 'change.txt')
    expect(test.check().stderr).toContain('nova entrada')
  }, 15000)
})
