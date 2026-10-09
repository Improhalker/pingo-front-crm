export interface AgentChange {
  id: string
  occurredAt: string
  agent: string
  summary: string
  detailsId?: string
}

export interface AgentChangeDetail {
  id: string
  changeId: string
  sections: { title: string; text: string }[]
}

export interface AgentChangeLog {
  schemaVersion: 1
  changes: AgentChange[]
  details: AgentChangeDetail[]
}

export const AGENT_CHANGE_MAX_CHARACTERS = 300

function object(value: unknown, keys: string[], path: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${path}: objeto obrigatório.`)
  const result = value as Record<string, unknown>
  if (Object.keys(result).some((key) => !keys.includes(key)))
    throw new Error(`${path}: campo desconhecido.`)
  return result
}

function shortText(
  value: unknown,
  path: string,
  max = AGENT_CHANGE_MAX_CHARACTERS,
) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim())
    throw new Error(`${path}: texto obrigatório, sem espaços nas extremidades.`)
  if ([...value].length > max)
    throw new Error(`${path}: máximo de ${max} caracteres.`)
  return value
}

function identifier(value: unknown, path: string) {
  const result = shortText(value, path, 100)
  if (!/^[a-z0-9][a-z0-9-]+$/.test(result))
    throw new Error(`${path}: use um identificador estável em minúsculas.`)
  return result
}

/** Shared contract only. The actual JSON must never be imported into Vue/client code. */
export function validateAgentChanges(value: unknown): AgentChangeLog {
  const log = object(
    value,
    ['schemaVersion', 'changes', 'details'],
    'histórico',
  )
  if (
    log.schemaVersion !== 1 ||
    !Array.isArray(log.changes) ||
    !Array.isArray(log.details)
  )
    throw new Error('Histórico: versão 1, changes e details obrigatórios.')
  const ids = new Set<string>()
  const changes: AgentChange[] = log.changes.map((value, index) => {
    const path = `changes[${index}]`
    const entry = object(
      value,
      ['id', 'occurredAt', 'agent', 'summary', 'detailsId'],
      path,
    )
    const id = identifier(entry.id, `${path}.id`)
    if (ids.has(id)) throw new Error(`${path}: identificador duplicado.`)
    ids.add(id)
    const occurredAt = shortText(entry.occurredAt, `${path}.occurredAt`, 30)
    const date = new Date(occurredAt)
    if (Number.isNaN(date.getTime()) || date.toISOString() !== occurredAt)
      throw new Error(`${path}: occurredAt deve ser ISO UTC com milissegundos.`)
    return {
      id,
      occurredAt,
      agent: shortText(entry.agent, `${path}.agent`, 80),
      summary: shortText(entry.summary, `${path}.summary`),
      ...(entry.detailsId === undefined
        ? {}
        : { detailsId: identifier(entry.detailsId, `${path}.detailsId`) }),
    }
  })
  const detailIds = new Set<string>()
  const details: AgentChangeDetail[] = log.details.map((value, index) => {
    const path = `details[${index}]`
    const detail = object(value, ['id', 'changeId', 'sections'], path)
    const id = identifier(detail.id, `${path}.id`)
    const changeId = identifier(detail.changeId, `${path}.changeId`)
    if (detailIds.has(id)) throw new Error(`${path}: identificador duplicado.`)
    detailIds.add(id)
    if (!Array.isArray(detail.sections) || !detail.sections.length)
      throw new Error(`${path}: detalhe precisa de pelo menos uma seção.`)
    const sections = detail.sections.map((value, sectionIndex) => {
      const sectionPath = `${path}.sections[${sectionIndex}]`
      const section = object(value, ['title', 'text'], sectionPath)
      return {
        title: shortText(section.title, `${sectionPath}.title`, 80),
        text: shortText(section.text, `${sectionPath}.text`),
      }
    })
    if (
      !changes.some(
        (change) => change.id === changeId && change.detailsId === id,
      )
    )
      throw new Error(`${path}: detalhe sem alteração correspondente.`)
    return { id, changeId, sections }
  })
  for (const change of changes) {
    if (change.detailsId && !detailIds.has(change.detailsId))
      throw new Error(`${change.id}: objeto de detalhes inexistente.`)
    if (
      change.detailsId &&
      !details.some(
        (detail) =>
          detail.id === change.detailsId && detail.changeId === change.id,
      )
    )
      throw new Error(`${change.id}: detalhe pertence a outra alteração.`)
  }
  return { schemaVersion: 1, changes, details }
}
