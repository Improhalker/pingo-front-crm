import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { validateAgentChanges } from '../shared/utils/agent-changes.ts'
const frontRoot = fileURLToPath(new URL('../', import.meta.url))
const git = (...args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
try {
  if (!git('diff', '--cached', '--name-only').trim()) process.exit(0)
  const reference = JSON.parse(git('show', ':.agent-change.json'))
  if (
    reference.frontRepository !== 'pingo-front-crm' ||
    !/^[0-9a-f]{40}$/.test(reference.frontCommit)
  )
    throw new Error('Referência do frontend inválida.')
  const history = validateAgentChanges(
    JSON.parse(
      git(
        '-C',
        frontRoot,
        'show',
        reference.frontCommit + ':data/agent-changes.json',
      ),
    ),
  )
  if (!history.changes.some((change) => change.id === reference.changeId))
    throw new Error(
      'Registro obrigatório: ID não encontrado no commit do frontend.',
    )
  const commits = git('log', '--all', '--format=%H', '--', '.agent-change.json')
    .trim()
    .split('\n')
    .filter(Boolean)
  for (const commit of commits) {
    const previous = JSON.parse(git('show', commit + ':.agent-change.json'))
    if (previous.changeId === reference.changeId)
      throw new Error(
        'Registro obrigatório: crie uma nova entrada no frontend e inclua uma nova referência no stage.',
      )
  }
  let previousReference
  const hasHead = git('rev-list', '--all', '--max-count=1').trim()
  if (
    hasHead &&
    git('ls-tree', '--name-only', 'HEAD', '--', '.agent-change.json').trim()
  ) {
    previousReference = JSON.parse(git('show', 'HEAD:.agent-change.json'))
    const previousHistory = validateAgentChanges(
      JSON.parse(
        git(
          '-C',
          frontRoot,
          'show',
          previousReference.frontCommit + ':data/agent-changes.json',
        ),
      ),
    )
    if (
      previousHistory.changes.some((change) => change.id === reference.changeId)
    )
      throw new Error(
        'Registro obrigatório: entrada precisa ser nova desde a última referência do frontend.',
      )
  }
  console.log('Histórico privado validado no frontend: ' + reference.changeId)
} catch (error) {
  console.error('Histórico de agentes: ' + error.message)
  process.exitCode = 1
}
