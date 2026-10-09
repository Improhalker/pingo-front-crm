# PingoFin — frontend CRM

Aplicação autenticada Nuxt 4/Vue 3: login, empresa única, administração da plataforma, dashboard, receitas/despesas, parcelas, correções, lembretes, relatórios e assistente local. Regras e cálculos financeiros pertencem à API Laravel. Pingo ainda não está integrado a IA.

## Desenvolvimento

Node compatível com engines de package.json. Na raiz deste repositório:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

No Windows, `scripts/setup-node.ps1` instala o runtime verificado; `scripts/npm.ps1` aceita os mesmos argumentos do npm. Prévia local: http://localhost:3000; API: http://localhost:8000.

Verificações: `npm run typecheck`, `npm run lint`, `npm test`, `npm run format:check`, `npm run build` e `npm run test:access` após build.

## Deploy e responsabilidades

Build: `npm ci && npm run build`; servidor: `node .output/server/index.mjs`. Requer Node/Nitro porque /api/platform/agent-changes verifica a sessão master e serve o histórico privado. Configurar NUXT_PUBLIC_API_BASE, NITRO_HOST e NITRO_PORT no ambiente de hospedagem. Não publicar como exportação estática. Não versionar .env, dependências ou builds.

Código em app/; tipos e validador em shared/; rotas privadas em server/; testes em tests/; histórico único em data/; assets públicos em public/. Originais visuais pertencem ao [repo de documentação](../pingo-doc/README.md).

[Mapa dos repositórios e validação da migração](../pingo-doc/MIGRACAO_REPOSITORIOS.md). [Regras dos agentes](./AGENTS.md).

## Histórico obrigatório

A fonte única é o JSON privado em `../pingo-front-crm/data/agent-changes.json`. Toda tarefa de agente deve acrescentar entrada imutável com resumo de até 300 caracteres Unicode e detalhes separados para mudanças complexas. Nunca copie o JSON para outro repositório, public/, bundle do navegador, banco ou localStorage.

No frontend, execute `node scripts/check-agent-changes.mjs --worktree` e inclua o JSON no stage. Commit do frontend deve preceder commits relacionados nos demais repositórios. Neles, atualize e inclua `.agent-change.json` com ID novo e SHA completo do commit do frontend que contém o registro. Os hooks leem o registro diretamente desse commit, recusam IDs reutilizados e não mantêm cópias do histórico.

Ative em cada clone: `git config --local core.hooksPath .githooks`. Não contornar a trava. Clone o frontend como irmão ou configure `PINGOFIN_FRONT_ROOT`. Linux usa Node compatível no PATH; Windows pode executar o setup-node.ps1 local.
