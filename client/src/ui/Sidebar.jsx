import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MdExpandMore, MdFactory } from 'react-icons/md'
import {
  buildNavItems,
  getActiveNavId,
  getAncestorIdsForPath,
  getNavItemByPath,
} from '../config/navigation'
import { APP_NAME, SIDEBAR_MOBILE_MQ } from '../constants/app'
import { useAuth } from '../context/AuthContext'
import { useRawMaterials } from '../context/RawMaterialContext'
import './Sidebar.css'

function Sidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { logout } = useAuth()
  const { items: materials } = useRawMaterials()
  const [isOpen, setIsOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  const navItems = useMemo(() => buildNavItems(materials), [materials])
  const activeId = getActiveNavId(pathname, materials)
  const activeItem = getNavItemByPath(pathname, materials)
  const routeExpanded = getAncestorIdsForPath(pathname, materials)

  // Open ancestor menus when route changes (still allow manual close after).
  useEffect(() => {
    const ancestors = getAncestorIdsForPath(pathname, materials)
    if (!ancestors.length) return
    setExpandedIds((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const id of ancestors) {
        if (!next.has(id)) {
          next.add(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
    // Only react to path changes so a manual close is not undone by materials refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (!isOpen) return undefined
    document.body.classList.add('is-sidebar-open')
    return () => document.body.classList.remove('is-sidebar-open')
  }, [isOpen])

  function toggleBranch(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function expandBranch(id) {
    setExpandedIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  function closeOnMobile() {
    if (window.matchMedia(SIDEBAR_MOBILE_MQ).matches) setIsOpen(false)
  }

  function handleChevronClick(e, id) {
    e.stopPropagation()
    if (!isOpen) setIsOpen(true)
    toggleBranch(id)
  }

  function handleItemClick(item, hasChildren) {
    if (hasChildren) {
      if (!isOpen) setIsOpen(true)
      expandBranch(item.id)
      if (item.path) {
        navigate(item.path)
        closeOnMobile()
      }
      return
    }
    if (!item.path) return
    navigate(item.path)
    closeOnMobile()
  }

  function renderItems(items, depth = 0) {
    return items.map((item) => {
      const hasChildren = Array.isArray(item.children)
      const isExpanded = expandedIds.has(item.id)
      const isActive = activeId === item.id
      const isInActivePath = routeExpanded.includes(item.id)
      const Icon = item.Icon

      return (
        <li key={item.id} className="sidebar__item">
          <button
            type="button"
            className={`sidebar__item-button sidebar__item-button--depth-${depth}${isActive ? ' sidebar__item-button--active' : ''}${isInActivePath && !isActive ? ' sidebar__item-button--trail' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            aria-expanded={hasChildren ? isExpanded : undefined}
            onClick={() => handleItemClick(item, hasChildren)}
          >
            {item.swatch ? (
              <span className="sidebar__swatch" style={{ backgroundColor: item.swatch }} />
            ) : (
              <span className="sidebar__icon"><Icon size={depth === 0 ? 20 : 17} /></span>
            )}
            <span className="sidebar__label">{item.label}</span>
            {isOpen && hasChildren && (
              <span
                className={`sidebar__chevron${isExpanded ? ' sidebar__chevron--open' : ''}`}
                role="button"
                tabIndex={-1}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                onClick={(e) => handleChevronClick(e, item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleChevronClick(e, item.id)
                }}
              >
                <MdExpandMore size={18} />
              </span>
            )}
            {!isOpen && depth === 0 && isInActivePath && activeItem?.swatch && (
              <span className="sidebar__active-dot" style={{ backgroundColor: activeItem.swatch }} />
            )}
          </button>
          {isOpen && hasChildren && isExpanded && (
            <ul className={`sidebar__sublist sidebar__sublist--depth-${depth + 1}`}>
              {item.children.length === 0 ? (
                <li className="sidebar__empty">No materials yet</li>
              ) : (
                renderItems(item.children, depth + 1)
              )}
            </ul>
          )}
        </li>
      )
    })
  }

  return (
    <>
      {isOpen && (
        <button type="button" className="sidebar-backdrop" aria-label="Close menu" onClick={() => setIsOpen(false)} />
      )}
      <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar__inner">
          <header className="sidebar__head">
            <button
              type="button"
              className="sidebar__menu-button"
              aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-expanded={isOpen}
              onClick={() => setIsOpen((o) => !o)}
            >
              <span className={`sidebar__hamburger${isOpen ? ' sidebar__hamburger--open' : ''}`}>
                <span /><span /><span />
              </span>
            </button>
            <div className="sidebar__brand">
              <span className="sidebar__brand-icon"><MdFactory size={18} /></span>
              <span className="sidebar__logo">{APP_NAME}</span>
            </div>
          </header>
          <nav className="sidebar__nav">
            <ul className="sidebar__list">{renderItems(navItems)}</ul>
          </nav>
          {isOpen && (
            <footer className="sidebar__foot">
              <button type="button" className="sidebar__logout" onClick={logout}>
                Sign out
              </button>
            </footer>
          )}
        </div>
      </aside>
    </>
  )
}

export default Sidebar
