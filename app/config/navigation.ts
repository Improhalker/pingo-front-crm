import type { Component } from 'vue'
import {
  BellRing,
  Building2,
  BuildingComplexPlus,
  ChartColumn,
  HandCoins,
  History,
  House,
  Tags,
  Wallet,
  Users,
} from '@lucide/vue'

export interface NavItem {
  label: string
  to: string
  /** Lucide icon; omitted for the Pingo item, which shows the mascot asset instead. */
  icon?: Component
  pingo?: boolean
  isCurrent: (path: string) => boolean
}
export interface NavSection {
  label: string
  items: NavItem[]
}

// Only screens that exist. Development and internal tools (Kanban, references) never appear here.
export const platformNavigation: NavSection[] = [
  {
    label: 'Empresas clientes',
    items: [
      {
        label: 'Empresas',
        to: '/plataforma',
        icon: Building2,
        isCurrent: (path) =>
          path === '/plataforma' ||
          (path.startsWith('/plataforma/empresas/') &&
            path !== '/plataforma/empresas/nova'),
      },
      {
        label: 'Cadastrar empresa',
        to: '/plataforma/empresas/nova',
        icon: BuildingComplexPlus,
        isCurrent: (path) => path === '/plataforma/empresas/nova',
      },
    ],
  },
  {
    label: 'Plataforma',
    items: [
      {
        label: 'Alterações',
        to: '/plataforma/alteracoes',
        icon: History,
        isCurrent: (path) => path === '/plataforma/alteracoes',
      },
    ],
  },
]

export const companyNavigation: NavSection[] = [
  {
    label: 'Seu espaço',
    items: [
      {
        label: 'Início',
        to: '/',
        icon: House,
        isCurrent: (path) => path === '/',
      },
      {
        label: 'Pingo',
        to: '/assistente',
        pingo: true,
        isCurrent: (path) => path === '/assistente',
      },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      {
        label: 'Receitas',
        to: '/receitas',
        icon: HandCoins,
        isCurrent: (path) =>
          path === '/receitas' || path.startsWith('/receitas/'),
      },
      {
        label: 'Despesas',
        to: '/despesas',
        icon: Wallet,
        isCurrent: (path) =>
          path === '/despesas' || path.startsWith('/despesas/'),
      },
      {
        label: 'Lembretes',
        to: '/lembretes',
        icon: BellRing,
        isCurrent: (path) => path === '/lembretes',
      },
      {
        label: 'Relatórios',
        to: '/relatorios',
        icon: ChartColumn,
        isCurrent: (path) => path === '/relatorios',
      },
      {
        label: 'Clientes',
        to: '/clientes',
        icon: Users,
        isCurrent: (path) => path === '/clientes',
      },
      {
        label: 'Categorias',
        to: '/categorias',
        icon: Tags,
        isCurrent: (path) => path === '/categorias',
      },
    ],
  },
]
