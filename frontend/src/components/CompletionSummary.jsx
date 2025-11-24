function CompletionSummary({ results, onStartNew }) {
  const successRate = results.totalAssets > 0
    ? Math.round((results.successful / results.totalAssets) * 100)
    : 0;

  const meetsTarget = successRate >= 99;

  return (
    <div className="completion-summary">
      <h2>Migration Complete</h2>

      <div className={`success-indicator ${meetsTarget ? 'success' : 'warning'}`}>
        {meetsTarget ? (
          <>
            <div className="success-icon">✓</div>
            <div className="success-message">
              Migration completed successfully with {successRate}% success rate
            </div>
          </>
        ) : (
          <>
            <div className="warning-icon">⚠</div>
            <div className="warning-message">
              Migration completed with {successRate}% success rate (target: ≥99%)
            </div>
          </>
        )}
      </div>

      <div className="summary-stats">
        <div className="summary-stat">
          <div className="summary-label">Total Assets Processed</div>
          <div className="summary-value">{results.totalAssets}</div>
        </div>

        <div className="summary-stat success">
          <div className="summary-label">Successful Transfers</div>
          <div className="summary-value">{results.successful}</div>
        </div>

        <div className="summary-stat error">
          <div className="summary-label">Failed Transfers</div>
          <div className="summary-value">{results.failed}</div>
        </div>

        <div className="summary-stat">
          <div className="summary-label">Success Rate</div>
          <div className="summary-value">{successRate}%</div>
        </div>
      </div>

      {results.errorLogPath && results.failed > 0 && (
        <div className="error-log-section">
          <h3>Error Log</h3>
          <p>
            {results.failed} asset{results.failed !== 1 ? 's' : ''} failed during migration.
            Review the error log for details:
          </p>
          <div className="error-log-path">
            <code>{results.errorLogPath}</code>
          </div>
          <a
            href={`/api/migration/error-log/${results.sessionId}`}
            download="error-log.json"
            className="download-button"
          >
            Download Error Log
          </a>
        </div>
      )}

      <div className="completion-actions">
        <button onClick={onStartNew} className="new-migration-button">
          Start New Migration
        </button>
      </div>

      <div className="completion-note">
        <h3>Next Steps</h3>
        <ul>
          <li>Verify assets in your BackBlaze B2 bucket: <strong>{results.bucketName}</strong></li>
          <li>Check JSON sidecar files for metadata completeness</li>
          {results.failed > 0 && (
            <li>Review error log to identify failed assets</li>
          )}
          <li>Consider running a test migration for your second SmugMug account</li>
        </ul>
      </div>
    </div>
  );
}

export default CompletionSummary;
