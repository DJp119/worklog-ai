/**
 * client/src/components/goals/LinkEditor.tsx
 *
 * View, add, and remove JIRA tickets and GitHub issues/PRs linked to a goal.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addLink, removeLink } from '../../lib/goalsApi'
import type { GoalLink } from 'shared'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link.mjs'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.mjs'

interface LinkEditorProps {
  goalId: string
  links: GoalLink[]
  onChange: () => void
}

export function LinkEditor({ goalId, links, onChange }: LinkEditorProps) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [weight, setWeight] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      await addLink(goalId, {
        url: url.trim(),
        label: label.trim() || undefined,
        weight: Number(weight) || 1,
      })
      setUrl('')
      setLabel('')
      setWeight('1')
      setAdding(false)
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(linkId: string) {
    if (!confirm(t('goals.confirmDeleteLink'))) return
    setError(null)
    try {
      await removeLink(goalId, linkId)
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {links.length > 0 ? (
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.id} className="glass rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs uppercase font-semibold ${
                  link.provider === 'jira'
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-indigo-500/20 text-indigo-300'
                }`}>
                  {link.provider}
                </span>
                <div>
                  {link.external_url ? (
                    <a
                      href={link.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white font-medium hover:underline flex items-center gap-1 text-sm text-left"
                    >
                      {link.title || link.external_key}
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400 inline" />
                    </a>
                  ) : (
                    <span className="text-white font-medium text-sm">
                      {link.title || link.external_key}
                      <span className="ml-1.5 text-xs text-gray-500 italic">(pending sync)</span>
                    </span>
                  )}
                  {link.state && (
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
                      link.is_done
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {link.state}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(link.id)}
                className="text-gray-400 hover:text-red-400 p-1.5 rounded transition-colors"
                title="Remove Link"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic px-1">
          {t('goals.noLinks')}
        </p>
      )}

      {adding ? (
        <form onSubmit={handleAdd} className="glass rounded-lg p-3 space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {t('goals.linkUrlOrKey')}
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. PROJ-123 or https://github.com/owner/repo/pull/1"
              className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-white text-sm focus:border-indigo-400 focus:outline-none"
              required
              disabled={submitting}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {t('goals.linkLabel')}
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Core Task"
                className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-white text-sm focus:border-indigo-400 focus:outline-none"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {t('goals.linkWeight')}
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="1"
                min="1"
                className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-white text-sm focus:border-indigo-400 focus:outline-none"
                disabled={submitting}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1 rounded bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
            >
              {submitting ? t('common.saving') : t('common.save')}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-3 py-1 rounded text-gray-300 hover:bg-white/5 text-sm"
              disabled={submitting}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full glass rounded-lg p-2 text-sm text-gray-300 hover:bg-white/5"
        >
          + {t('goals.addLink')}
        </button>
      )}
    </div>
  )
}
