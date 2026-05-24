import React from 'react';

interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  category: 'news' | 'model' | 'startup' | 'research' | 'tool';
  summary: string;
  sourceUrl?: string;
}

const categoryStyles = {
  news: { color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/50' },
  model: { color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/50' },
  startup: { color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/50' },
  research: { color: 'text-pink-400', bg: 'bg-pink-500/20', border: 'border-pink-500/50' },
  tool: { color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/50' },
};

interface TimelineProps {
  title?: string;
  events: TimelineEvent[];
}

export const Timeline: React.FC<TimelineProps> = ({ title = "Today in AI", events }) => {
  return (
    <div className="w-full">
      <h2 className="text-xl font-bold text-white mb-4">{title}</h2>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500" />

        <div className="space-y-4">
          {events.map((event) => {
            const style = categoryStyles[event.category];
            return (
              <div key={event.id} className="relative pl-12 group">
                {/* Dot */}
                <div
                  className={`absolute left-2 top-1 w-3 h-3 rounded-full ${style.bg} border ${style.border} ring-2 ring-opacity-50 ring-indigo-500/50`}
                />

                {/* Content */}
                <div className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${style.color}`}>
                          {event.time}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${style.bg} ${style.color} border ${style.border}`}>
                          {event.category.toUpperCase()}
                        </span>
                      </div>

                      <h3 className="text-white font-semibold mb-1 group-hover:text-indigo-300 transition-colors">
                        {event.title}
                      </h3>

                      <p className="text-sm text-gray-400">{event.summary}</p>
                    </div>

                    {event.sourceUrl && (
                      <a
                        href={event.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded text-xs transition-colors whitespace-nowrap"
                      >
                        Read →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};