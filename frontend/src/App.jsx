import { useState } from 'react';
import ConfigurationScreen from './components/ConfigurationScreen';
import ProgressMonitor from './components/ProgressMonitor';
import CompletionSummary from './components/CompletionSummary';

function App() {
  const [screen, setScreen] = useState('config'); // 'config', 'progress', 'complete'
  const [sessionId, setSessionId] = useState(null);
  const [migrationResults, setMigrationResults] = useState(null);

  const handleMigrationStart = (session) => {
    setSessionId(session);
    setScreen('progress');
  };

  const handleMigrationComplete = (results) => {
    setMigrationResults(results);
    setScreen('complete');
  };

  const handleStartNew = () => {
    setSessionId(null);
    setMigrationResults(null);
    setScreen('config');
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>SmugMug Asset Retrieval System</h1>
      </header>

      <main className="app-main">
        {screen === 'config' && (
          <ConfigurationScreen onStart={handleMigrationStart} />
        )}

        {screen === 'progress' && (
          <ProgressMonitor
            sessionId={sessionId}
            onComplete={handleMigrationComplete}
          />
        )}

        {screen === 'complete' && (
          <CompletionSummary
            results={migrationResults}
            onStartNew={handleStartNew}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>Personal utility tool for SmugMug to BackBlaze B2 migration</p>
      </footer>
    </div>
  );
}

export default App;
