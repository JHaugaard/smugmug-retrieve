import { useState, useEffect } from 'react';
import useSSE from '../hooks/useSSE';

function ProgressMonitor({ sessionId, onComplete }) {
  const [progress, setProgress] = useState({
    phase: 'initializing',
    discovered: 0,
    downloaded: 0,
    uploaded: 0,
    errors: 0,
    currentOperation: 'Starting migration...'
  });

  const [errorLog, setErrorLog] = useState([]);

  useSSE(`/api/migration/progress/${sessionId}`, {
    onPhase: (data) => {
      setProgress(prev => ({
        ...prev,
        phase: data.phase,
        currentOperation: data.message
      }));
    },
    onProgress: (data) => {
      setProgress(prev => ({ ...prev, ...data }));
    },
    onOperation: (data) => {
      setProgress(prev => ({
        ...prev,
        currentOperation: data.message
      }));
    },
    onError: (data) => {
      setErrorLog(prev => [...prev, data]);
      setProgress(prev => ({
        ...prev,
        errors: prev.errors + 1
      }));
    },
    onComplete: (data) => {
      onComplete(data);
    }
  });

  const calculatePercentage = (current, total) => {
    if (total === 0) return 0;
    return Math.round((current / total) * 100);
  };

  return (
    <div className="progress-monitor">
      <h2>Migration in Progress</h2>

      <div className="phase-indicator">
        <div className="current-phase">{progress.phase}</div>
        <div className="current-operation">{progress.currentOperation}</div>
      </div>

      <div className="progress-stats">
        <div className="stat-card">
          <div className="stat-label">Discovered</div>
          <div className="stat-value">{progress.discovered}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Downloaded</div>
          <div className="stat-value">
            {progress.downloaded}
            {progress.discovered > 0 && (
              <span className="stat-percentage">
                {' '}({calculatePercentage(progress.downloaded, progress.discovered)}%)
              </span>
            )}
          </div>
          {progress.discovered > 0 && (
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${calculatePercentage(progress.downloaded, progress.discovered)}%` }}
              />
            </div>
          )}
        </div>

        <div className="stat-card">
          <div className="stat-label">Uploaded</div>
          <div className="stat-value">
            {progress.uploaded}
            {progress.discovered > 0 && (
              <span className="stat-percentage">
                {' '}({calculatePercentage(progress.uploaded, progress.discovered)}%)
              </span>
            )}
          </div>
          {progress.discovered > 0 && (
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${calculatePercentage(progress.uploaded, progress.discovered)}%` }}
              />
            </div>
          )}
        </div>

        <div className="stat-card error-card">
          <div className="stat-label">Errors</div>
          <div className="stat-value">{progress.errors}</div>
        </div>
      </div>

      {errorLog.length > 0 && (
        <div className="error-preview">
          <h3>Recent Errors</h3>
          <div className="error-list">
            {errorLog.slice(-5).map((error, index) => (
              <div key={index} className="error-item">
                <span className="error-filename">{error.filename}</span>
                <span className="error-message">{error.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="progress-note">
        <p>Please keep this window open while migration is in progress.</p>
        <p>This may take several hours depending on the number of assets.</p>
      </div>
    </div>
  );
}

export default ProgressMonitor;
