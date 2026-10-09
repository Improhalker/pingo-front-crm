import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { validateAgentChanges } from '../shared/utils/agent-changes.ts'

const logPath = 'data/agent-changes.json'
const args = process.argv.slice(2)
const staged = args.includes('--staged')
const worktree = args.includes('--worktree')
const baseIndex = args.indexOf('--base')
const base = baseIndex < 0 ? 'HEAD' : args[baseIndex + 1]
const empty = { schemaVersion: 1, changes: [], details: [] }

function git(...command) {
  return execFileSync('git', command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function previousLog(ref) {
  if (!ref) throw new Error('--base precisa de uma referência Git.')
  try {
    git('rev-parse', '--verify', `${ref}^{commit}`)
  } catch (error) {
    if (ref === 'HEAD' && !git('rev-list', '--all', '--max-count=1').trim())
      return empty
    throw error
  }
  try {
    return validateAgentChanges(JSON.parse(git('show', `${ref}:${logPath}`)))
  } catch (error) {
    // Only an absent file is an empty history. A malformed existing history is an error.
    if (!git('ls-tree', '--name-only', ref, '--', logPath).trim()) return empty
    throw error
  }
}

function preserve(previous, current, collection) {
  for (const entry of previous[collection]) {
    const next = current[collection].find(
      (candidate) => candidate.id === entry.id,
    )
    if (!next || !isDeepStrictEqual(next, entry))
      throw new Error(
        `Histórico imutável: preserve ${collection}/${entry.id}; registre uma nova alteração.`,
      )
  }
}

try {
  if (staged && worktree)
    throw new Error('Use --staged ou --worktree, separadamente.')
  const root = git('rev-parse', '--show-toplevel').trim()
  const changed = staged
    ? git('diff', '--cached', '--name-only', '-z').split('\0').filter(Boolean)
    : []
  if (staged && !changed.length) {
    console.log('Histórico: nenhum arquivo no stage.')
  } else {
    const content = staged
      ? git('show', `:${logPath}`)
      : readFileSync(join(root, logPath), 'utf8')
    const current = validateAgentChanges(JSON.parse(content))
    if (staged || worktree || baseIndex >= 0) {
      const previous = previousLog(base)
      preserve(previous, current, 'changes')
      preserve(previous, current, 'details')
      const hasChanges =
        staged ||
        git('status', '--porcelain', '--untracked-files=normal').trim().length >
          0
      if (
        hasChanges &&
        !current.changes.some(
          (entry) => !previous.changes.some((old) => old.id === entry.id),
        )
      )
        throw new Error(
          'Registro obrigatório: adicione uma nova alteração ao JSON; no commit, inclua o JSON no stage.',
        )
    }
    console.log(
      `Histórico válido: ${current.changes.length} alteração(ões); resumos e detalhes de até 300 caracteres.`,
    )
  }
} catch (error) {
  console.error(`Histórico de agentes: ${error.message}`)
  process.exitCode = 1
}
