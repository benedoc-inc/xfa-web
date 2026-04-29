import type { FormSection } from '../types/schema'
import type { SectionCompletion } from '../utils/sectionIndex'
import { formatFieldName } from '../utils/formatFieldName'

export type { SectionCompletion }

interface Props {
  sections: FormSection[]
  active: string
  onSelect: (name: string) => void
  completion: Record<string, SectionCompletion>
}

function CompletionDot({ filled, required, visible }: SectionCompletion) {
  if (visible === 0) return <span className="w-2 h-2 rounded-full bg-gray-100 flex-shrink-0" />
  if (required === 0) return <span className="w-2 h-2 rounded-full bg-gray-200 flex-shrink-0" />
  if (filled === required) return <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
  if (filled > 0) return <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
  return <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
}

function SectionItem({
  section,
  depth,
  active,
  onSelect,
  completion,
}: {
  section: FormSection
  depth: number
  active: string
  onSelect: (name: string) => void
  completion: Record<string, SectionCompletion>
}) {
  const isActive = section.name === active
  const comp = completion[section.name] ?? { filled: 0, required: 0, visible: 0 }
  const isEmpty = comp.visible === 0
  const interactiveChildren = (section.children ?? []).filter(
    c => c.interactive || (c.children ?? []).some(hasInteractiveDescendant),
  )
  const pl = depth * 12 + 8

  return (
    <>
      {section.interactive ? (
        <button
          onClick={() => onSelect(section.name)}
          style={{ paddingLeft: pl }}
          className={[
            'flex items-center gap-2 text-left py-1.5 pr-2 rounded-md transition-colors w-full',
            depth === 0 ? 'text-sm' : 'text-xs',
            isActive
              ? 'bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-500 rounded-l-none'
              : isEmpty
                ? 'text-gray-300 hover:bg-gray-50 hover:text-gray-400'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          ].join(' ')}
        >
          <CompletionDot {...comp} />
          <span className="truncate">{formatFieldName(section.name)}</span>
        </button>
      ) : (
        // Non-interactive section header — shown only when it has interactive children
        interactiveChildren.length > 0 && (
          <div
            style={{ paddingLeft: pl }}
            className="flex items-center gap-2 py-1 pr-2 text-xs font-semibold text-gray-400 uppercase tracking-wide select-none"
          >
            {formatFieldName(section.name)}
          </div>
        )
      )}
      {interactiveChildren.map(child => (
        <SectionItem
          key={child.name}
          section={child}
          depth={depth + 1}
          active={active}
          onSelect={onSelect}
          completion={completion}
        />
      ))}
    </>
  )
}

function hasInteractiveDescendant(sec: FormSection): boolean {
  if (sec.interactive) return true
  return (sec.children ?? []).some(hasInteractiveDescendant)
}

export default function SectionNav({ sections, active, onSelect, completion }: Props) {
  return (
    <nav className="w-52 flex-shrink-0 flex flex-col gap-0.5 overflow-y-auto py-1 pr-2">
      {sections.map(sec => (
        <SectionItem
          key={sec.name}
          section={sec}
          depth={0}
          active={active}
          onSelect={onSelect}
          completion={completion}
        />
      ))}
    </nav>
  )
}
