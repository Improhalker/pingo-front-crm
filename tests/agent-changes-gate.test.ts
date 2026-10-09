import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const checker = resolve('scripts/check-agent-changes.mjs')
const logPath = 'data/agent-changes.json'
const temporaryRepos: string[] = []
const entry = {
  id: 'original-change',
  occurredAt: '2026-10-05T21:04:00.000Z',
  agent: 'Agente de teste',
  summary: 'Alteração original.',
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'pingofin-agent-log-test-'))
  temporaryRepos.push(root)
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, stdio: 'pipe' })
  mkdirSync(join(root, 'data'), { recursive: true })
  const log = { schemaVersion: 1, changes: [{ ...entry }], details: [] }
  const save = () => writeFileSync(join(root, logPath), JSON.stringify(log))
  save()
  git('init', '--quiet')
  git('add', '.')
  git(
    '-c',
    'user.name=Log Test',
    '-c',
    'user.email=log@test.invalid',
    '-c',
    'core.hooksPath=nonexistent-test-hooks',
    'commit',
    '--quiet',
    '-m',
    'test baseline',
  )
  writeFileSync(join(root, 'change.txt'), 'A new change')
  git('add', 'change.txt')
  const check = () =>
    spawnSync(process.execPath, [checker, '--staged'], {
      cwd: root,
      encoding: 'utf8',
    })
  return { root, log, save, git, check }
}

afterEach(() => {
  for (const root of temporaryRepos.splice(0)) {
    if (!root.startsWith(join(tmpdir(), 'pingofin-agent-log-test-')))
      throw new Error('Unexpected cleanup target')
    rmSync(root, { recursive: true, force: true })
  }
})

describe('mandatory staged change registration', () => {
  it('validates the first staged commit of an empty repository', () => {
    const root = mkdtempSync(join(tmpdir(), 'pingofin-agent-log-test-'))
    temporaryRepos.push(root)
    mkdirSync(join(root, 'data'), { recursive: true })
    writeFileSync(
      join(root, logPath),
      JSON.stringify({ schemaVersion: 1, changes: [entry], details: [] }),
    )
    execFileSync('git', ['init', '--quiet'], { cwd: root })
    execFileSync('git', ['add', '.'], { cwd: root })
    const result = spawnSync(process.execPath, [checker, '--staged'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
  }, 15000)

  it('rejects changes without a newly staged log entry, including an unstaged entry', () => {
    const test = fixture()
    expect(test.check().stderr).toContain('Registro obrigatório')
    test.log.changes.push({
      ...entry,
      id: 'new-change',
      summary: 'Nova alteração.',
    })
    test.save()
    expect(test.check().status).toBe(1)
    test.git('add', logPath)
    expect(test.check().status).toBe(0)
  }, 15000)

  it('rejects rewriting committed history even alongside a new entry', () => {
    const test = fixture()
    test.log.changes[0]!.summary = 'Reescrita indevida.'
    test.log.changes.push({ ...entry, id: 'new-change' })
    test.save()
    test.git('add', logPath)
    expect(test.check().stderr).toContain('Histórico imutável')
  }, 15000)

  it('validates the JSON in the index even when the working copy has been repaired', () => {
    const test = fixture()
    test.log.changes.push({
      ...entry,
      id: 'new-change',
      summary: 'x'.repeat(301),
    })
    test.save()
    test.git('add', logPath)
    test.log.changes[1]!.summary = 'Resumo corrigido, ainda fora do stage.'
    test.save()
    const result = test.check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('300 caracteres')
  }, 15000)
})
