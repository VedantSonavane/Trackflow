import { useEffect, useState, useCallback } from 'react';
import { v4: uuidv4 } from 'uuid';

/**
 * useNudges — Connect to the nudge-stream SSE endpoint and manage nudge state
 * @param {string} apiKey - The site's API key (required for SSE connection)
 * Returns: { nudges, removeNudge }
 */
export function useNudges(apiKey) {
  const [nudges, setNudges] = useState([]);
  const [sessionId] = useState(() => {
    let sid = sessionStorage.getItem('nudge_session_id');
    if (!sid) {
      sid = uuidv4();
      sessionStorage.setItem('nudge_session_id', sid);
    }
    return sid;
  });

  const removeNudge = useCallback((nudgeId) => {
    setNudges(prev => prev.filter(n => n.nudge_id !== nudgeId));
  }, []);

  useEffect(() => {
    if (!apiKey) return; // No API key yet

    const tabId = uuidv4(); // Unique per browser tab

    // Connect to SSE stream
    const eventSource = new EventSource(
      `/nudge-stream?k=${encodeURIComponent(apiKey)}&sid=${encodeURIComponent(sessionId)}`
    );

    eventSource.onmessage = (event) => {
      try {
        const nudge = JSON.parse(event.data);
        
        // Skip handshake message
        if (nudge.type === 'connected') {
          console.log('[Nudge] SSE connection established');
          return;
        }
        
        // Auto-remove expired nudges
        if (nudge.expires_ts && Date.now() > nudge.expires_ts) return;

        console.log('[Nudge] Received nudge:', nudge);
        setNudges(prev => [...prev, nudge]);

        // Auto-remove after 30 seconds (matches backend expires_ts)
        const timer = setTimeout(() => {
          removeNudge(nudge.nudge_id);
        }, 30000);

        // Cleanup timer if nudge removed manually
        return () => clearTimeout(timer);
      } catch (err) {
        console.error('[Nudge] Failed to parse nudge:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('[Nudge] Stream error:', err);
      eventSource.close();
      // Reconnect after 5 seconds
      setTimeout(() => {
        // The hook will re-run if apiKey changes
      }, 5000);
    };

    return () => eventSource.close();
  }, [apiKey, sessionId, removeNudge]);

  return { nudges, removeNudge };
}
