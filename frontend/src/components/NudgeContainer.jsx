import React from 'react';
import { X, AlertCircle, Info } from 'lucide-react';

/**
 * NudgeContainer — Renders nudges from the SSE stream
 * Displays tooltips (inline near cursor) and banners (top-of-page)
 */
export default function NudgeContainer({ nudges, onRemove }) {
  const banners = nudges.filter(n => n.type === 'banner');
  const tooltips = nudges.filter(n => n.type === 'tooltip');

  const getPriorityStyling = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'medium':
        return 'bg-amber-50 border-amber-200 text-amber-900';
      case 'low':
      default:
        return 'bg-blue-50 border-blue-200 text-blue-900';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  return (
    <>
      {/* Banners: fixed at top */}
      <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
        {banners.map(nudge => (
          <div
            key={nudge.nudge_id}
            className={`mx-auto mt-2 max-w-2xl px-4 py-3 border rounded-lg shadow-sm pointer-events-auto flex items-center justify-between gap-3 animate-in slide-in-from-top-2 ${getPriorityStyling(
              nudge.priority
            )}`}
          >
            <div className="flex items-center gap-2">
              {getPriorityIcon(nudge.priority)}
              <span className="text-sm font-medium">{nudge.message}</span>
            </div>
            <button
              onClick={() => onRemove(nudge.nudge_id)}
              className="flex-shrink-0 hover:opacity-70 transition-opacity"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Tooltips: floating near interactions */}
      <div className="fixed inset-0 z-40 pointer-events-none">
        {tooltips.map(nudge => (
          <div
            key={nudge.nudge_id}
            className={`absolute bottom-20 right-8 max-w-xs px-4 py-3 border rounded-lg shadow-lg pointer-events-auto flex items-center justify-between gap-3 animate-in fade-in ${getPriorityStyling(
              nudge.priority
            )}`}
          >
            <div className="flex items-center gap-2">
              {getPriorityIcon(nudge.priority)}
              <span className="text-sm font-medium">{nudge.message}</span>
            </div>
            <button
              onClick={() => onRemove(nudge.nudge_id)}
              className="flex-shrink-0 hover:opacity-70 transition-opacity"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
