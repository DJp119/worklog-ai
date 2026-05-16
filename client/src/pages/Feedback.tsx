import { useState, useEffect } from 'react'
import { submitFeedback, getFeedbackHistory, FeedbackItem } from '../lib/api'

const categories = [
  {
    value: 'bug' as const,
    label: 'Bug Report',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    color: 'from-red-500 to-orange-500',
    glowColor: 'rgba(239, 68, 68, 0.3)',
    bgColor: 'from-red-500/20 to-orange-500/20',
    description: 'Something isn\'t working right',
  },
  {
    value: 'feature' as const,
    label: 'Feature Request',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
      </svg>
    ),
    color: 'from-cyan-500 to-blue-500',
    glowColor: 'rgba(6, 182, 212, 0.3)',
    bgColor: 'from-cyan-500/20 to-blue-500/20',
    description: 'Suggest a new capability',
  },
  {
    value: 'improvement' as const,
    label: 'Improvement',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
      </svg>
    ),
    color: 'from-amber-500 to-yellow-500',
    glowColor: 'rgba(245, 158, 11, 0.3)',
    bgColor: 'from-amber-500/20 to-yellow-500/20',
    description: 'Make something better',
  },
  {
    value: 'general' as const,
    label: 'General',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
      </svg>
    ),
    color: 'from-indigo-500 to-purple-500',
    glowColor: 'rgba(99, 102, 241, 0.3)',
    bgColor: 'from-indigo-500/20 to-purple-500/20',
    description: 'Share your thoughts',
  },
]

const starLabels = ['Poor', 'Fair', 'Good', 'Great', 'Amazing']

export default function Feedback() {
  const [category, setCategory] = useState<'bug' | 'feature' | 'improvement' | 'general' | null>(null)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<FeedbackItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    try {
      const data = await getFeedbackHistory()
      setHistory(data)
    } catch (err) {
      console.error('Failed to load feedback history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!category) {
      setError('Please select a feedback category')
      return
    }
    if (rating === 0) {
      setError('Please select a rating')
      return
    }
    if (message.trim().length < 10) {
      setError('Please provide at least 10 characters of feedback')
      return
    }

    setIsSubmitting(true)

    try {
      await submitFeedback({
        category,
        rating,
        message: message.trim(),
        page_context: 'feedback',
      })

      setSubmitted(true)
      setCategory(null)
      setRating(0)
      setMessage('')

      // Reload history
      await loadHistory()

      // Reset submitted state after animation
      setTimeout(() => setSubmitted(false), 5000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback')
    } finally {
      setIsSubmitting(false)
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function getCategoryInfo(cat: string) {
    return categories.find(c => c.value === cat) || categories[3]
  }

  const selectedCategory = category ? categories.find(c => c.value === category) : null

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center px-4 py-2 rounded-full glass mb-6">
          <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
          <span className="text-sm text-gray-300">We Value Your Input</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Share Your <span className="gradient-text">Feedback</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          Help us improve Worklog AI by sharing your experience, ideas, and suggestions.
          Every piece of feedback matters.
        </p>
      </div>

      {/* Success Animation */}
      {submitted && (
        <div className="glass-strong rounded-2xl p-8 text-center relative overflow-hidden animate-fadeIn">
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-cyan-500/10"></div>
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto mb-4"
              style={{ boxShadow: '0 0 30px rgba(16, 185, 129, 0.4)' }}>
              <svg className="w-10 h-10 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Thank You! 🎉</h3>
            <p className="text-gray-400">Your feedback has been submitted successfully. We truly appreciate your input!</p>
          </div>
        </div>
      )}

      {/* Feedback Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Category Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-4">
            What type of feedback do you have?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                id={`feedback-category-${cat.value}`}
                onClick={() => setCategory(cat.value)}
                className={`relative group p-5 rounded-2xl border transition-all duration-300 text-left overflow-hidden ${
                  category === cat.value
                    ? 'border-white/20 scale-[1.02]'
                    : 'border-white/5 hover:border-white/15 hover:scale-[1.01]'
                }`}
                style={{
                  background: category === cat.value
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(255, 255, 255, 0.03)',
                  boxShadow: category === cat.value
                    ? `0 0 30px ${cat.glowColor}, 0 20px 40px rgba(0, 0, 0, 0.3)`
                    : 'none',
                }}
              >
                {/* Gradient corner accent */}
                <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${cat.bgColor} rounded-bl-full opacity-60 transition-opacity ${
                  category === cat.value ? 'opacity-100' : 'group-hover:opacity-80'
                }`}></div>

                <div className="relative">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center mb-3`}
                    style={category === cat.value ? { boxShadow: `0 0 20px ${cat.glowColor}` } : {}}>
                    <div className="text-white">{cat.icon}</div>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{cat.label}</h3>
                  <p className="text-xs text-gray-500">{cat.description}</p>
                </div>

                {/* Selected indicator */}
                {category === cat.value && (
                  <div className="absolute top-3 right-3">
                    <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${cat.color} flex items-center justify-center`}>
                      <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Star Rating */}
        <div className="glass rounded-2xl p-6">
          <label className="block text-sm font-medium text-gray-300 mb-4">
            How would you rate your overall experience?
          </label>
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  id={`feedback-star-${star}`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="group relative p-1 transition-transform duration-200 hover:scale-125 focus:outline-none"
                  style={{
                    transform: (hoverRating >= star || rating >= star) ? 'scale(1.1)' : 'scale(1)',
                  }}
                >
                  <svg
                    className={`w-10 h-10 transition-all duration-300 ${
                      (hoverRating >= star || (!hoverRating && rating >= star))
                        ? 'text-amber-400 drop-shadow-lg'
                        : 'text-gray-600 hover:text-gray-500'
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    style={{
                      filter: (hoverRating >= star || (!hoverRating && rating >= star))
                        ? 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))'
                        : 'none',
                    }}
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>
            <span className={`text-sm font-medium transition-all duration-300 ${
              (hoverRating || rating) ? 'text-amber-400' : 'text-gray-500'
            }`}>
              {hoverRating ? starLabels[hoverRating - 1] : rating ? starLabels[rating - 1] : 'Select a rating'}
            </span>
          </div>
        </div>

        {/* Message Input */}
        <div className="glass rounded-2xl p-6">
          <label htmlFor="feedback-message" className="block text-sm font-medium text-gray-300 mb-3">
            Tell us more
            {selectedCategory && (
              <span className="text-gray-500 font-normal ml-2">
                — {selectedCategory.value === 'bug' ? 'What went wrong?' :
                   selectedCategory.value === 'feature' ? 'What would you like to see?' :
                   selectedCategory.value === 'improvement' ? 'How can we do better?' :
                   'What\'s on your mind?'}
              </span>
            )}
          </label>
          <div className="relative">
            <textarea
              id="feedback-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              placeholder={
                category === 'bug' ? 'Describe the issue you encountered, steps to reproduce, and what you expected to happen...' :
                category === 'feature' ? 'Describe the feature you\'d like to see and how it would help your workflow...' :
                category === 'improvement' ? 'What existing feature could be improved and how would you change it...' :
                'Share your thoughts, ideas, or any feedback about your experience...'
              }
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 resize-none focus:border-indigo-500/50 focus:bg-white/[0.07] transition-all duration-300"
              style={{
                outline: 'none',
              }}
            />
            <div className="flex justify-between items-center mt-2 px-1">
              <span className={`text-xs ${message.length > 1800 ? 'text-amber-400' : 'text-gray-600'}`}>
                {message.length < 10 && message.length > 0 ? `${10 - message.length} more characters needed` : ''}
              </span>
              <span className={`text-xs ${message.length > 1800 ? 'text-amber-400' : 'text-gray-600'}`}>
                {message.length}/2000
              </span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-center">
          <button
            type="submit"
            id="feedback-submit"
            disabled={isSubmitting || !category || rating === 0 || message.trim().length < 10}
            className={`group relative inline-flex items-center px-10 py-4 rounded-xl text-lg font-semibold transition-all duration-300 ${
              isSubmitting || !category || rating === 0 || message.trim().length < 10
                ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 text-white hover:shadow-2xl hover:shadow-indigo-500/25 glow-primary'
            }`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </>
            ) : (
              <>
                Send Feedback
                <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Feedback History Toggle */}
      {history.length > 0 && (
        <div className="pt-4">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-center gap-3 py-4 text-gray-400 hover:text-white transition-colors group"
          >
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            <span className="text-sm font-medium flex items-center gap-2">
              {showHistory ? 'Hide' : 'View'} Your Previous Feedback ({history.length})
              <svg className={`w-4 h-4 transition-transform duration-300 ${showHistory ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          </button>

          {showHistory && (
            <div className="space-y-4 mt-4">
              {loadingHistory ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : (
                history.map((item) => {
                  const catInfo = getCategoryInfo(item.category)
                  return (
                    <div key={item.id} className="glass rounded-xl p-5 card-hover">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${catInfo.color} flex items-center justify-center flex-shrink-0`}>
                            <div className="text-white scale-75">{catInfo.icon}</div>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-white">{catInfo.label}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                  key={star}
                                  className={`w-3.5 h-3.5 ${star <= item.rating ? 'text-amber-400' : 'text-gray-700'}`}
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-gray-600 whitespace-nowrap">{formatDate(item.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-3 leading-relaxed">{item.message}</p>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
