import { MdGrain, MdLayers, MdPrecisionManufacturing, MdSpaceDashboard, MdViewDay } from 'react-icons/md'

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
      Icon: MdPrecisionManufacturing,
      path: '/mills-production',
      children: [
        {
          id: 'mills-role',
          label: 'Role',
          Icon: MdViewDay,
          path: '/mills-production/role',
        },
        {
          id: 'mills-bundle',
          label: 'Bundle',
          Icon: MdLayers,
          path: '/mills-production/bundle',
        },
      ],
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
  if (pathname === '/mills-production') return { section: 'mills-production' }
  if (pathname === '/mills-production/role') return { section: 'mills-role' }
  if (pathname === '/mills-production/bundle') return { section: 'mills-bundle' }
  return null
}

export function getActiveNavId(pathname, materials = []) {
  const mills = parseMillsPath(pathname)
  if (mills) return mills.section

  const raw = parseRawMaterialPath(pathname, materials)
  if (raw?.material) return raw.material.slug
  if (raw) return 'raw-material'
  return 'dashboard'
}

export function getNavItemByPath(pathname, materials = []) {
  const mills = parseMillsPath(pathname)
  if (mills) {
    const items = buildNavItems(materials)
    const parent = items.find((item) => item.id === 'mills-production')
    if (mills.section === 'mills-production') return parent
    return parent?.children?.find((child) => child.id === mills.section) || parent
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
  const mills = parseMillsPath(pathname)
  if (mills?.section === 'mills-role' || mills?.section === 'mills-bundle') {
    return ['mills-production']
  }

  const raw = parseRawMaterialPath(pathname, materials)
  // Only force-open when a child material page is active.
  if (raw?.material) return ['raw-material']
  return []
}
