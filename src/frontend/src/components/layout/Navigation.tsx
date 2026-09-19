import { ChevronLeft } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { navigationItems } from '../../data/mockData'
import { sectionPaths } from '../../routes'

interface NavigationProps {
  isSuperuser: boolean
  onNavigate?: () => void
}

export function Navigation({ isSuperuser, onNavigate }: NavigationProps) {
  const workspaceItems = navigationItems.filter((item) => !item.superuserOnly)
  const platformItems = navigationItems.filter(
    (item) => item.superuserOnly && isSuperuser,
  )

  const renderItems = (items: typeof navigationItems) =>
    items.map((item) => {
      const Icon = item.icon

      return (
        <li key={item.id}>
          <NavLink className="navigation__item" to={sectionPaths[item.id]} onClick={onNavigate}>
            <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
            <span>{item.label}</span>
            <ChevronLeft
              className="navigation__chevron"
              size={15}
              aria-hidden="true"
            />
          </NavLink>
        </li>
      )
    })

  return (
    <nav className="navigation" aria-label="ناوبری اصلی">
      <p className="navigation__eyebrow">فضای کار</p>
      <ul className="navigation__list">{renderItems(workspaceItems)}</ul>
      {platformItems.length ? (
        <>
          <p className="navigation__eyebrow navigation__eyebrow--platform">کنترل سکو</p>
          <ul className="navigation__list">{renderItems(platformItems)}</ul>
        </>
      ) : null}
    </nav>
  )
}
