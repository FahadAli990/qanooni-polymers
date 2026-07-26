import { GiBrickWall, GiPipes } from 'react-icons/gi'
import {
  MdAccountBalanceWallet,
  MdApartment,
  MdBuild,
  MdDonutLarge,
  MdFactory,
  MdGrain,
  MdGroups,
  MdLocalShipping,
  MdPayments,
  MdReceiptLong,
  MdRoofing,
  MdRoute,
  MdSpaceDashboard,
} from 'react-icons/md'

export function buildNavItems(materials = []) {
  return [
    { id: 'dashboard', label: 'Dashboard', Icon: MdSpaceDashboard, path: '/' },
    {
      id: 'raw-material',
      label: 'Raw Material',
      Icon: MdGrain,
      path: '/raw-material',
      children: materials.map((m) => ({
        id: m.slug,
        label: m.name,
        swatch: m.swatch,
        path: `/raw-material/${m.slug}`,
      })),
    },
    {
      id: 'mills-production',
      label: 'Mills & Production',
      Icon: MdFactory,
      children: [
        {
          id: 'mills-roll',
          label: 'Roll',
          Icon: MdDonutLarge,
          path: '/mills-production/roll',
        },
        {
          id: 'mills-bundle',
          label: 'Bundle',
          Icon: GiPipes,
          children: [
            {
              id: 'mills-bundle-chaat',
              label: 'Chaat',
              Icon: MdRoofing,
              path: '/mills-production/bundle/chaat',
            },
            {
              id: 'mills-bundle-dewaar',
              label: 'Dewaar',
              Icon: GiBrickWall,
              path: '/mills-production/bundle/dewaar',
            },
          ],
        },
      ],
    },
    {
      id: 'routes',
      label: 'Routes',
      Icon: MdRoute,
      path: '/routes',
    },
    {
      id: 'orders',
      label: 'Orders',
      Icon: MdReceiptLong,
      path: '/orders',
    },
    {
      id: 'bills-payments',
      label: 'Bills & Payments',
      Icon: MdPayments,
      path: '/bills-payments',
    },
    {
      id: 'suppliers',
      label: 'Suppliers',
      Icon: MdLocalShipping,
      path: '/suppliers',
    },
    {
      id: 'daily-expense',
      label: 'Daily Expense',
      Icon: MdAccountBalanceWallet,
      path: '/daily-expense',
    },
    {
      id: 'maintenance',
      label: 'Maintenance',
      Icon: MdBuild,
      path: '/maintenance',
    },
    {
      id: 'rents',
      label: 'Rents',
      Icon: MdApartment,
      path: '/rents',
    },
    {
      id: 'workers',
      label: 'Workers & Salary',
      Icon: MdGroups,
      path: '/workers',
    },
  ]
}

function parseRawMaterialPath(pathname, materials) {
  if (pathname === '/raw-material') return { material: null }
  if (!pathname.startsWith('/raw-material/')) return null
  const slug = pathname.split('/')[2]
  return { material: materials.find((m) => m.slug === slug) || null }
}

function parseMillsPath(pathname) {
  if (pathname === '/mills-production/roll' || pathname === '/mills-production/role') {
    return { section: 'mills-roll', ancestors: ['mills-production'] }
  }
  if (pathname === '/mills-production/bundle/chaat') {
    return { section: 'mills-bundle-chaat', ancestors: ['mills-production', 'mills-bundle'] }
  }
  if (pathname === '/mills-production/bundle/dewaar') {
    return { section: 'mills-bundle-dewaar', ancestors: ['mills-production', 'mills-bundle'] }
  }
  return null
}

function parseRoutesPath(pathname) {
  if (pathname === '/routes' || pathname.startsWith('/routes/')) {
    return { section: 'routes', ancestors: [] }
  }
  return null
}

function parseOrdersPath(pathname) {
  if (pathname === '/orders' || pathname.startsWith('/orders/')) {
    return { section: 'orders', ancestors: [] }
  }
  return null
}

function parseBillsPaymentsPath(pathname) {
  if (pathname === '/bills-payments' || pathname.startsWith('/bills-payments/')) {
    return { section: 'bills-payments', ancestors: [] }
  }
  return null
}

function parseSuppliersPath(pathname) {
  if (pathname === '/suppliers' || pathname.startsWith('/suppliers/')) {
    return { section: 'suppliers', ancestors: [] }
  }
  return null
}

function parseDailyExpensePath(pathname) {
  if (pathname === '/daily-expense' || pathname.startsWith('/daily-expense/')) {
    return { section: 'daily-expense', ancestors: [] }
  }
  return null
}

function parseMaintenancePath(pathname) {
  if (pathname === '/maintenance' || pathname.startsWith('/maintenance/')) {
    return { section: 'maintenance', ancestors: [] }
  }
  return null
}

function parseRentsPath(pathname) {
  if (pathname === '/rents' || pathname.startsWith('/rents/')) {
    return { section: 'rents', ancestors: [] }
  }
  return null
}

function parseWorkersPath(pathname) {
  if (pathname === '/workers' || pathname.startsWith('/workers/')) {
    return { section: 'workers', ancestors: [] }
  }
  return null
}

function findNavItemById(items, id) {
  for (const item of items) {
    if (item.id === id) return item
    if (item.children?.length) {
      const found = findNavItemById(item.children, id)
      if (found) return found
    }
  }
  return null
}

const TOP_LEVEL_PARSERS = [
  parseWorkersPath,
  parseRentsPath,
  parseMaintenancePath,
  parseDailyExpensePath,
  parseSuppliersPath,
  parseBillsPaymentsPath,
  parseOrdersPath,
  parseRoutesPath,
]

export function getActiveNavId(pathname, materials = []) {
  for (const parse of TOP_LEVEL_PARSERS) {
    const nav = parse(pathname)
    if (nav) return nav.section
  }

  const mills = parseMillsPath(pathname)
  if (mills) return mills.section

  const raw = parseRawMaterialPath(pathname, materials)
  if (raw?.material) return raw.material.slug
  if (raw) return 'raw-material'
  return 'dashboard'
}

export function getNavItemByPath(pathname, materials = []) {
  for (const parse of TOP_LEVEL_PARSERS) {
    const nav = parse(pathname)
    if (nav) {
      return buildNavItems(materials).find((item) => item.id === nav.section)
    }
  }

  const mills = parseMillsPath(pathname)
  if (mills) {
    return findNavItemById(buildNavItems(materials), mills.section)
  }

  const raw = parseRawMaterialPath(pathname, materials)
  if (raw?.material) {
    return {
      id: raw.material.slug,
      label: raw.material.name,
      swatch: raw.material.swatch,
      path: pathname,
    }
  }
  return buildNavItems(materials).find((item) => item.path === pathname)
}

export function getAncestorIdsForPath(pathname, materials = []) {
  for (const parse of TOP_LEVEL_PARSERS) {
    const nav = parse(pathname)
    if (nav) return []
  }

  const mills = parseMillsPath(pathname)
  if (mills?.ancestors?.length) return mills.ancestors

  const raw = parseRawMaterialPath(pathname, materials)
  if (raw?.material) return ['raw-material']
  return []
}
