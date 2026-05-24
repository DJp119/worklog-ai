import React, { useRef } from 'react';

interface ShareCardProps {
  title: string;
  subtitle: string;
  stat?: string;
  statLabel?: string;
  imageUrl?: string;
  onCopy?: (dataUrl: string) => void;
}

export const ShareCard: React.FC<ShareCardProps> = ({
  title,
  subtitle,
  stat,
  statLabel,
  imageUrl,
  onCopy,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      // Simple text copy fallback
      const text = `${title}\n${subtitle}${stat ? `\n${stat} - ${statLabel}` : ''}`;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShareX = () => {
    const text = encodeURIComponent(`${title} - ${subtitle}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  const handleShareLinkedIn = () => {
    const text = encodeURIComponent(`${title} - ${subtitle}`);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${text}`, '_blank');
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Preview Card */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-8 border border-white/20 shadow-2xl"
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
        </div>

        {/* Content */}
        <div className="relative">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-48 object-cover rounded-lg mb-4"
            />
          )}

          <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
          <p className="text-indigo-200 mb-4">{subtitle}</p>

          {stat && statLabel && (
            <div className="inline-block px-4 py-2 bg-white/10 rounded-lg backdrop-blur">
              <p className="text-3xl font-bold text-white">{stat}</p>
              <p className="text-sm text-indigo-200">{statLabel}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-white/20 flex items-center justify-between">
            <span className="text-sm text-indigo-300">impactlyai.com</span>
            <span className="text-xs text-indigo-400">Powered by ImpactlyAI</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors border border-white/20"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Text
            </>
          )}
        </button>

        <button
          onClick={handleShareX}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1DA1F2]/20 hover:bg-[#1DA1F2]/30 rounded-lg text-white transition-colors border border-[#1DA1F2]/50"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          X
        </button>

        <button
          onClick={handleShareLinkedIn}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-[#0077B5]/20 hover:bg-[#0077B5]/30 rounded-lg text-white transition-colors border border-[#0077B5]/50"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
          LinkedIn
        </button>
      </div>
    </div>
  );
};