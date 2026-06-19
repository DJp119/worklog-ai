/**
 * client/src/components/goals/KeyResultEditor.tsx
 *
 * List and add key results to a goal. Inline edit current value triggers progress recompute.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addKeyResult, updateKeyResult, METRIC_TYPES } from '../../lib/goalsApi'
import type { GoalKeyResult, MetricType } from 'shared'

interface KeyResultEditorProps {
  goalId: string
  keyResults: GoalKeyResult[]
  onChange: () => void
}

export function KeyResultEditor({ goalId, keyResults, onChange }: KeyResultEditorProps) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [metricType, setMetricType] = useState<MetricType>('number')
  const [target, setTarget] = useState('100')
  const [unit, setUnit] = useState('')

  async function handleAdd() {
    if (!title.trim()) return
    await addKeyResult(goalId, {
      title: title.trim(),
      metricType,
      targetValue: Number(target),
      startValue: 0,
      unit: unit.trim() || null,
      weight: 1,
    })
    setTitle('')
    setUnit('')
    setAdding(false)
    onChange()
  }

  async function handleUpdateCurrent(kr: GoalKeyResult, currentValue: number) {
    await updateKeyResult(goalId, kr.id, { currentValue } as Partial<GoalKeyResult>)
    onChange()
  }

  return (
    <div className="space-y-2">
      {keyResults.map((kr) => (
        <div key={kr.id} className="glass rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">{kr.title}</p>
              <p className="text-xs text-gray-400">
                {kr.metric_type} • target {kr.target_value}
                {kr.unit ? ` ${kr.unit}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">Current:</span>
              <input
                type="number"
                defaultValue={kr.current_value}
                onBlur={(e) => {
                  const v = Number(e.target.value)
                  if (v !== kr.current_value) handleUpdateCurrent(kr, v)
                }}
                className="w-24 rounded bg-white/5 border border-white/10 px-2 py-1 text-white text-right"
              />
              {kr.unit && <span className="text-gray-400">{kr.unit}</span>}
            </div>
          </div>
        </div>
      ))}
      {adding ? (
        <div className="glass rounded-lg p-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('goals.krTitlePlaceholder')}
            className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-white"
          />
          <div className="flex gap-2">
            <select
              value={metricType}
              onChange={(e) => setMetricType(e.target.value as MetricType)}
              className="rounded bg-white/5 border border-white/10 px-2 py-1 text-white"
            >
              {METRIC_TYPES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="target"
              className="w-24 rounded bg-white/5 border border-white/10 px-2 py-1 text-white"
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="unit"
              className="w-20 rounded bg-white/5 border border-white/10 px-2 py-1 text-white"
            />
            <button
              onClick={handleAdd}
              className="px-3 py-1 rounded bg-indigo-500/30 text-indigo-100 hover:bg-indigo-500/50"
            >
              {t('common.save')}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-1 rounded text-gray-300 hover:bg-white/5"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full glass rounded-lg p-2 text-sm text-gray-300 hover:bg-white/5"
        >
          + {t('goals.addKeyResult')}
        </button>
      )}
    </div>
  )
}
