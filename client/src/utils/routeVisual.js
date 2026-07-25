import {
  MdAltRoute,
  MdDirectionsBike,
  MdDirectionsBus,
  MdDirectionsCar,
  MdExplore,
  MdLocalShipping,
  MdMap,
  MdNavigation,
  MdPlace,
  MdRoute,
  MdSignpost,
  MdTerrain,
} from 'react-icons/md'

const ROUTE_ICONS = [
  { Icon: MdRoute, tone: '#0f766e' },
  { Icon: MdMap, tone: '#1d4ed8' },
  { Icon: MdPlace, tone: '#b45309' },
  { Icon: MdDirectionsCar, tone: '#7c2d12' },
  { Icon: MdLocalShipping, tone: '#334155' },
  { Icon: MdNavigation, tone: '#6d28d9' },
  { Icon: MdExplore, tone: '#0e7490' },
  { Icon: MdAltRoute, tone: '#be123c' },
  { Icon: MdDirectionsBus, tone: '#047857' },
  { Icon: MdSignpost, tone: '#9a3412' },
  { Icon: MdTerrain, tone: '#365314' },
  { Icon: MdDirectionsBike, tone: '#1e3a8a' },
]

function hashKey(value) {
  const text = String(value || '')
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  }
  return hash
}

/** Stable unique-looking icon + accent for a route slug/id. */
export function getRouteVisual(key) {
  const index = hashKey(key) % ROUTE_ICONS.length
  return ROUTE_ICONS[index]
}
