/**
 * client/src/components/teams/TeamTree.tsx
 *
 * Recursive team tree (uses team_closure on the server). Indents children.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Team } from 'shared'

interface TeamNode {
  team: Team
  children: TeamNode[]
}

interface TeamTreeProps {
  teams: Team[]
  selectedTeamId?: string
  onSelect?: (team: Team) => void
  orgId: string
}

function buildTree(teams: Team[]): TeamNode[] {
  const byId = new Map<string, TeamNode>()
  teams.forEach((t) => byId.set(t.id, { team: t, children: [] }))
  const roots: TeamNode[] = []
  byId.forEach((node) => {
    const parent = node.team.parent_team_id
    if (parent && byId.has(parent)) {
      byId.get(parent)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

export function TeamTree({ teams, selectedTeamId, onSelect }: TeamTreeProps) {
  const { t } = useTranslation()
  const tree = buildTree(teams)
  if (tree.length === 0) {
    return <p className="text-sm text-gray-500">{t('teams.noTeams')}</p>
  }
  return (
    <ul className="space-y-1">
      {tree.map((n) => (
        <TreeNode
          key={n.team.id}
          node={n}
          depth={0}
          selectedTeamId={selectedTeamId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  )
}

function TreeNode({
  node,
  depth,
  selectedTeamId,
  onSelect,
}: {
  node: TeamNode
  depth: number
  selectedTeamId?: string
  onSelect?: (t: Team) => void
}) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  const isSelected = node.team.id === selectedTeamId
  return (
    <li>
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
          isSelected ? 'bg-indigo-500/30 text-white' : 'text-gray-300 hover:bg-white/5'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setOpen(!open)}
            className="w-4 h-4 flex items-center justify-center text-gray-400"
            aria-label={open ? 'collapse' : 'expand'}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <button
          onClick={() => onSelect?.(node.team)}
          className="flex-1 text-left truncate"
        >
          {node.team.name}
        </button>
      </div>
      {open && hasChildren && (
        <ul>
          {node.children.map((c) => (
            <TreeNode
              key={c.team.id}
              node={c}
              depth={depth + 1}
              selectedTeamId={selectedTeamId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
