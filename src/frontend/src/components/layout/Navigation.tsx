import { ChevronLeft } from 'lucide-react'

import { navigationItems } from '../../data/mockData'
import type { SectionId } from '../../types'

interface NavigationProps {
  activeSection: SectionId
  isSuperuser: boolean
  onSelect: (section: SectionId) => void
}

export function Navigation({
  activeSection,
  isSuperuser,
  onSelect,
}: NavigationProps) {
  const workspaceItems = navigationItems.filter((item) => !item.superuserOnly)
  const platformItems = navigationItems.filter(
    (item) => item.superuserOnly && isSuperuser,
  )

  const renderItems = (items: typeof navigationItems) =>
    items.map((item) => {
      const Icon = item.icon
      const isActive = item.id === activeSection

      return (
        <li key={item.id}>
          <button
            className="navigation__item"
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(item.id)}
          >
            <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
            <span>{item.label}</span>
            <ChevronLeft
              className="navigation__chevron"
              size={15}
              aria-hidden="true"
            />
          </button>
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
