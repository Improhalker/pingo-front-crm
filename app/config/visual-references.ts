export const pingoAssets = {
  normal: {
    src: '/referencias/pingo/pingo-normal.png',
    alt: 'Pingo sorrindo e dando boas-vindas',
  },
  pensando: {
    src: '/referencias/pingo/pingo-pensando.png',
    alt: 'Pingo pensando com a mão no queixo',
  },
  insight: {
    src: '/referencias/pingo/pingo-insight.png',
    alt: 'Pingo segurando uma lâmpada amarela',
  },
} as const

export const chartReferences = [
  {
    id: 'fluxo-caixa',
    title: 'Entradas e saídas',
    description:
      'Comparação mensal de recebimentos e pagamentos. Valores exclusivamente ilustrativos.',
  },
  {
    id: 'recebimentos-semana',
    title: 'Recebimentos na semana',
    description:
      'Barras de valores recebidos por dia. Valores exclusivamente ilustrativos.',
  },
  {
    id: 'despesas-categoria',
    title: 'Despesas por categoria',
    description:
      'Distribuição de pagamentos por categoria, com percentuais e legenda textual. Valores exclusivamente ilustrativos.',
  },
] as const

export function chartReferenceSrc(id: string, theme: 'light' | 'dark') {
  return `/referencias/graficos/${id}-${theme}.svg`
}
