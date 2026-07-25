import { GiBrickWall, GiPipes } from 'react-icons/gi'
import { MdDonutLarge, MdFactory, MdGrain, MdRoofing, MdRoute, MdSpaceDashboard } from 'react-icons/md'

export function buildNavItems(materials = [], routes = []) {
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
      children: routes.map((r) => ({
        id: `route-${r.slug}`,
        label: r.name,
        Icon: MdRoute,
        path: `/routes/${r.slug}`,
      })),
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

function parseRoutesPath(pathname, routes = []) {
  if (pathname === '/routes') {
    return { section: 'routes', ancestors: [] }
  }
  if (pathname.startsWith('/routes/')) {
    const slug = pathname.split('/')[2]
    const route = routes.find((r) => r.slug === slug)
    if (!route) {
      return { section: 'routes', ancestors: ['routes'] }
    }
    return {
      section: `route-${route.slug}`,
      ancestors: ['routes'],
    }
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

export function getActiveNavId(pathname, materials = [], routes = []) {
  const routeNav = parseRoutesPath(pathname, routes)
  if (routeNav) return routeNav.section

  const mills = parseMillsPath(pathname)
  if (mills) return mills.section

  const raw = parseRawMaterialPath(pathname, materials)
  if (raw?.material) return raw.material.slug
  if (raw) return 'raw-material'
  return 'dashboard'
}

export function getNavItemByPath(pathname, materials = [], routes = []) {
  const routeNav = parseRoutesPath(pathname, routes)
  if (routeNav) {
    return findNavItemById(buildNavItems(materials, routes), routeNav.section)
  }

  const mills = parseMillsPath(pathname)
  if (mills) {
    return findNavItemById(buildNavItems(materials, routes), mills.section)
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
  return buildNavItems(materials, routes).find((item) => item.path === pathname)
}

export function getAncestorIdsForPath(pathname, materials = [], routes = []) {
  const routeNav = parseRoutesPath(pathname, routes)
  if (routeNav?.ancestors?.length) return routeNav.ancestors
  // Open Routes when on the list page itself? No - only when child active (same as raw material)
  if (routeNav?.section === 'routes') return []

  const mills = parseMillsPath(pathname)
  if (mills?.ancestors?.length) return mills.ancestors

  const raw = parseRawMaterialPath(pathname, materials)
  if (raw?.material) return ['raw-material']
  return []
}
