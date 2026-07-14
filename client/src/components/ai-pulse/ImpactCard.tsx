import React from 'react';

interface ImpactCardProps {
  industry: string;
  whatChanged: string;
  impactLevel: 'high' | 'medium' | 'low';
  companiesInvolved: string[];
  opportunities: string[];
  risks: string[];
  tools: string[];
  futurePrediction: string;
}

const impactStyles = {
  high: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/50',
    text: 'text-red-400',
    gradient: 'from-red-500/20 to-transparent',
  },
  medium: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/50',
    text: 'text-yellow-400',
    gradient: 'from-yellow-500/20 to-transparent',
  },
  low: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/50',
    text: 'text-green-400',
    gradient: 'from-green-500/20 to-transparent',
  },
};

export const ImpactCard: React.FC<ImpactCardProps> = ({
  industry,
  whatChanged,
  impactLevel,
  companiesInvolved,
  opportunities,
  risks,
  tools,
  futurePrediction,
}) => {
  const style = impactStyles[impactLevel];

  // Helper to ensure values are arrays, parsing strings if necessary
  const ensureArray = (val: string | string[] | null | undefined | unknown): string[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        // Strip braces and split by commas, taking care of outer quotes
        const inner = trimmed.slice(1, -1).trim();
        if (!inner) return [];
        
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        let escaped = false;
        for (let i = 0; i < inner.length; i++) {
          const char = inner[i];
          if (escaped) {
            current += char;
            escaped = false;
          } else if (char === '\\') {
            escaped = true;
          } else if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        
        return result.map(item => {
          if (item.startsWith('"') && item.endsWith('"')) {
            return item.slice(1, -1);
          }
          return item;
        });
      }
      return [val];
    }
    return [];
  };

  const parsedCompanies = ensureArray(companiesInvolved);
  const parsedOpportunities = ensureArray(opportunities);
  const parsedRisks = ensureArray(risks);
  const parsedTools = ensureArray(tools);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${style.border} ${style.bg} p-6 hover:scale-[1.02] transition-transform`}
    >
      {/* Gradient overlay */}
      <div
        className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${style.gradient} blur-2xl`}
      />

      {/* Header */}
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-bold text-white">{industry}</h3>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${style.text} ${style.bg} border ${style.border}`}
          >
            {impactLevel.toUpperCase()} IMPACT
          </span>
        </div>

        {/* What Changed */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-1">
            What Changed
          </h4>
          <p className="text-gray-200 text-sm">{whatChanged}</p>
        </div>

        {/* Companies */}
        {parsedCompanies.length > 0 && (
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-500 mb-1">
              COMPANIES
            </h4>
            <div className="flex flex-wrap gap-1">
              {parsedCompanies.map((company) => (
                <span
                  key={company}
                  className="px-2 py-0.5 bg-white/5 rounded text-xs text-gray-300"
                >
                  {company}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tools */}
        {parsedTools.length > 0 && (
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-500 mb-1">
              TOOLS
            </h4>
            <div className="flex flex-wrap gap-1">
              {parsedTools.map((tool) => (
                <span
                  key={tool}
                  className="px-2 py-0.5 bg-indigo-500/20 rounded-full text-xs text-indigo-300 border border-indigo-500/30"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Opportunities */}
        {parsedOpportunities.length > 0 && (
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-500 mb-1">
              OPPORTUNITIES
            </h4>
            <ul className="space-y-1">
              {parsedOpportunities.map((opp, idx) => (
                <li key={idx} className="text-xs text-gray-300 flex items-start gap-1">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>{opp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risks */}
        {parsedRisks.length > 0 && (
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-500 mb-1">
              RISKS
            </h4>
            <ul className="space-y-1">
              {parsedRisks.map((risk, idx) => (
                <li key={idx} className="text-xs text-gray-300 flex items-start gap-1">
                  <span className="text-red-400 mt-0.5">⚠</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Future Prediction */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <h4 className="text-xs font-semibold text-gray-500 mb-1">
            FUTURE PREDICTION
          </h4>
          <p className="text-sm text-gray-300">{futurePrediction}</p>
        </div>
      </div>
    </div>
  );
};