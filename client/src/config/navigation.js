import { GiBrickWall, GiPipes } from 'react-icons/gi'
import { MdDonutLarge, MdFactory, MdGrain, MdRoofing, MdRoute, MdSpaceDashboard } from 'react-icons/md'

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

export function getActiveNavId(pathname, materials = []) {
  const routeNav = parseRoutesPath(pathname)
  if (routeNav) return routeNav.section

  const mills = parseMillsPath(pathname)
  if (mills) return mills.section

  const raw = parseRawMaterialPath(pathname, materials)
  if (raw?.material) return raw.material.slug
  if (raw) return 'raw-material'
  return 'dashboard'
}

export function getNavItemByPath(pathname, materials = []) {
  const routeNav = parseRoutesPath(pathname)
  if (routeNav) {
    return buildNavItems(materials).find((item) => item.id === 'routes')
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
  const routeNav = parseRoutesPath(pathname)
  if (routeNav) return []

  const mills = parseMillsPath(pathname)
  if (mills?.ancestors?.length) return mills.ancestors

  const raw = parseRawMaterialPath(pathname, materials)
  if (raw?.material) return ['raw-material']
  return []
}
