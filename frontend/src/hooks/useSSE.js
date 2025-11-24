import { useEffect } from 'react';

/**
 * Custom hook for Server-Sent Events (SSE)
 * @param {string} url - SSE endpoint URL
 * @param {object} handlers - Event handlers for different event types
 */
function useSSE(url, handlers) {
  useEffect(() => {
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log('SSE connection opened');
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      if (handlers.onError) {
        handlers.onError({ error: 'Connection error' });
      }
    };

    // Handle custom event types
    if (handlers.onPhase) {
      eventSource.addEventListener('phase', (event) => {
        const data = JSON.parse(event.data);
        handlers.onPhase(data);
      });
    }

    if (handlers.onProgress) {
      eventSource.addEventListener('progress', (event) => {
        const data = JSON.parse(event.data);
        handlers.onProgress(data);
      });
    }

    if (handlers.onOperation) {
      eventSource.addEventListener('operation', (event) => {
        const data = JSON.parse(event.data);
        handlers.onOperation(data);
      });
    }

    if (handlers.onError) {
      eventSource.addEventListener('error', (event) => {
        const data = JSON.parse(event.data);
        handlers.onError(data);
      });
    }

    if (handlers.onComplete) {
      eventSource.addEventListener('complete', (event) => {
        const data = JSON.parse(event.data);
        handlers.onComplete(data);
        eventSource.close();
      });
    }

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, [url]);
}

export default useSSE;
