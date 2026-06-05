import React, { useState } from 'react';
import { getStoredTokens } from '../../lib/authStorage';

interface BookmarkBtnProps {
  targetId?: string;
  targetType?: 'article' | 'impact_card';
  isAuthenticated: boolean;
  onNeedAuth?: () => void;
}

export const BookmarkBtn: React.FC<BookmarkBtnProps> = ({
  targetId,
  targetType,
  isAuthenticated,
  onNeedAuth,
}) => {
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const handleBookmark = async () => {
    if (!isAuthenticated) {
      onNeedAuth?.();
      return;
    }

    if (!targetId) {
      console.error('No targetId provided for bookmark');
      return;
    }

    setLoading(true);
    try {
      const payload = targetType === 'article'
        ? { article_id: targetId }
        : { impact_card_id: targetId };

      const { accessToken } = getStoredTokens();
      const response = await fetch(`${API_URL}/api/ai-pulse/bookmarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setBookmarked(!bookmarked);
      } else {
        console.error('Bookmark failed:', data.error);
      }
    } catch (err) {
      console.error('Bookmark request failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleBookmark}
      disabled={loading}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
        bookmarked
          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
          : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
      }`}
    >
      <svg
        className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
      <span className="text-sm">{bookmarked ? 'Saved' : 'Save'}</span>
    </button>
  );
};