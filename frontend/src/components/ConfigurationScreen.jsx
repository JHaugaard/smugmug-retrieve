import { useState } from 'react';

function ConfigurationScreen({ onStart }) {
  const [config, setConfig] = useState({
    smugmugApiKey: '',
    smugmugApiSecret: '',
    smugmugAccessToken: '',
    smugmugAccessTokenSecret: '',
    b2AccountId: '',
    b2ApplicationKey: '',
    b2BucketName: '',
    testMode: false,
    testAssetLimit: 10
  });

  const [oauthState, setOauthState] = useState({
    requestToken: null,
    requestTokenSecret: null,
    authorizeUrl: null,
    isAuthenticating: false,
    authenticated: false,
    verifier: ''
  });

  const [testing, setTesting] = useState({
    smugmug: false,
    b2: false
  });

  const [errors, setErrors] = useState({});

  const handleInputChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  /**
   * Step 1: Initiate SmugMug OAuth flow
   */
  const initiateSmugMugAuth = async () => {
    if (!config.smugmugApiKey || !config.smugmugApiSecret) {
      setErrors(prev => ({ ...prev, smugmug: 'API Key and Secret are required' }));
      return;
    }

    setTesting(prev => ({ ...prev, smugmug: true }));
    setErrors(prev => ({ ...prev, smugmug: null }));

    try {
      const response = await fetch('/api/migration/test/smugmug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: config.smugmugApiKey,
          apiSecret: config.smugmugApiSecret
        })
      });

      const data = await response.json();

      if (data.success && data.requiresAuth) {
        // OAuth flow required
        setOauthState({
          requestToken: data.requestToken,
          requestTokenSecret: data.requestToken, // Note: API should return requestTokenSecret
          authorizeUrl: data.authorizeUrl,
          isAuthenticating: true,
          authenticated: false,
          verifier: ''
        });

        // Open authorization URL in new window
        window.open(data.authorizeUrl, '_blank', 'width=800,height=600');

      } else if (data.success) {
        // Already authenticated (tokens provided)
        setOauthState(prev => ({ ...prev, authenticated: true }));
        alert(`Authenticated as ${data.user.Name || 'SmugMug user'}`);
      } else {
        setErrors(prev => ({ ...prev, smugmug: data.error }));
      }
    } catch (error) {
      setErrors(prev => ({ ...prev, smugmug: error.message }));
    } finally {
      setTesting(prev => ({ ...prev, smugmug: false }));
    }
  };

  /**
   * Step 2: Complete SmugMug OAuth with verifier code
   */
  const completeSmugMugAuth = async () => {
    if (!oauthState.verifier) {
      setErrors(prev => ({ ...prev, smugmug: 'Verification code is required' }));
      return;
    }

    setTesting(prev => ({ ...prev, smugmug: true }));
    setErrors(prev => ({ ...prev, smugmug: null }));

    try {
      const response = await fetch('/api/migration/smugmug/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: config.smugmugApiKey,
          apiSecret: config.smugmugApiSecret,
          requestToken: oauthState.requestToken,
          requestTokenSecret: oauthState.requestTokenSecret,
          verifier: oauthState.verifier
        })
      });

      const data = await response.json();

      if (data.success) {
        // Save access tokens
        setConfig(prev => ({
          ...prev,
          smugmugAccessToken: data.accessToken,
          smugmugAccessTokenSecret: data.accessTokenSecret
        }));

        setOauthState(prev => ({
          ...prev,
          isAuthenticating: false,
          authenticated: true
        }));

        alert(`Successfully authenticated as ${data.user.name || data.user.nickName}!`);
      } else {
        setErrors(prev => ({ ...prev, smugmug: data.error }));
      }
    } catch (error) {
      setErrors(prev => ({ ...prev, smugmug: error.message }));
    } finally {
      setTesting(prev => ({ ...prev, smugmug: false }));
    }
  };

  const testB2Connection = async () => {
    setTesting(prev => ({ ...prev, b2: true }));
    try {
      const response = await fetch('/api/migration/test/b2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: config.b2AccountId,
          applicationKey: config.b2ApplicationKey,
          bucketName: config.b2BucketName
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`BackBlaze B2 connection successful! Bucket: ${data.bucket.bucketName}`);
      } else {
        setErrors(prev => ({ ...prev, b2: data.error }));
      }
    } catch (error) {
      setErrors(prev => ({ ...prev, b2: error.message }));
    } finally {
      setTesting(prev => ({ ...prev, b2: false }));
    }
  };

  const handleStartMigration = async () => {
    // Validate all fields
    const newErrors = {};
    if (!config.smugmugApiKey) newErrors.smugmugApiKey = 'Required';
    if (!config.smugmugApiSecret) newErrors.smugmugApiSecret = 'Required';
    if (!config.smugmugAccessToken) newErrors.smugmugAccessToken = 'SmugMug authentication required';
    if (!config.smugmugAccessTokenSecret) newErrors.smugmugAccessTokenSecret = 'SmugMug authentication required';
    if (!config.b2AccountId) newErrors.b2AccountId = 'Required';
    if (!config.b2ApplicationKey) newErrors.b2ApplicationKey = 'Required';
    if (!config.b2BucketName) newErrors.b2BucketName = 'Required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const response = await fetch('/api/migration/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smugmug: {
            apiKey: config.smugmugApiKey,
            apiSecret: config.smugmugApiSecret,
            accessToken: config.smugmugAccessToken,
            accessTokenSecret: config.smugmugAccessTokenSecret
          },
          backblaze: {
            accountId: config.b2AccountId,
            applicationKey: config.b2ApplicationKey,
            bucketName: config.b2BucketName
          },
          testMode: config.testMode,
          testAssetLimit: config.testAssetLimit
        })
      });

      const data = await response.json();
      if (data.success) {
        onStart(data.sessionId);
      } else {
        setErrors({ general: data.error });
      }
    } catch (error) {
      setErrors({ general: error.message });
    }
  };

  return (
    <div className="configuration-screen">
      <h2>Migration Configuration</h2>

      <section className="config-section">
        <h3>SmugMug Credentials</h3>
        <div className="form-group">
          <label>API Key</label>
          <input
            type="text"
            value={config.smugmugApiKey}
            onChange={(e) => handleInputChange('smugmugApiKey', e.target.value)}
            placeholder="Enter SmugMug API Key"
            disabled={oauthState.authenticated}
          />
          {errors.smugmugApiKey && <span className="error">{errors.smugmugApiKey}</span>}
        </div>

        <div className="form-group">
          <label>API Secret</label>
          <input
            type="password"
            value={config.smugmugApiSecret}
            onChange={(e) => handleInputChange('smugmugApiSecret', e.target.value)}
            placeholder="Enter SmugMug API Secret"
            disabled={oauthState.authenticated}
          />
          {errors.smugmugApiSecret && <span className="error">{errors.smugmugApiSecret}</span>}
        </div>

        {!oauthState.isAuthenticating && !oauthState.authenticated && (
          <button
            onClick={initiateSmugMugAuth}
            disabled={!config.smugmugApiKey || !config.smugmugApiSecret || testing.smugmug}
            className="auth-button"
          >
            {testing.smugmug ? 'Connecting...' : 'Authenticate with SmugMug'}
          </button>
        )}

        {oauthState.isAuthenticating && (
          <div className="oauth-flow">
            <p className="oauth-instructions">
              1. A new window has opened with SmugMug authorization page<br/>
              2. Approve the access request<br/>
              3. Copy the verification code and paste it below
            </p>
            <div className="form-group">
              <label>Verification Code</label>
              <input
                type="text"
                value={oauthState.verifier}
                onChange={(e) => setOauthState(prev => ({ ...prev, verifier: e.target.value }))}
                placeholder="Paste verification code here"
              />
            </div>
            <button
              onClick={completeSmugMugAuth}
              disabled={!oauthState.verifier || testing.smugmug}
              className="auth-button"
            >
              {testing.smugmug ? 'Verifying...' : 'Complete Authentication'}
            </button>
            <button
              onClick={() => setOauthState({
                requestToken: null,
                requestTokenSecret: null,
                authorizeUrl: null,
                isAuthenticating: false,
                authenticated: false,
                verifier: ''
              })}
              className="cancel-button"
            >
              Cancel
            </button>
          </div>
        )}

        {oauthState.authenticated && (
          <div className="auth-success">
            ✓ SmugMug authentication successful
          </div>
        )}

        {errors.smugmug && <div className="error-message">{errors.smugmug}</div>}
      </section>

      <section className="config-section">
        <h3>BackBlaze B2 Credentials</h3>
        <div className="form-group">
          <label>Account ID</label>
          <input
            type="text"
            value={config.b2AccountId}
            onChange={(e) => handleInputChange('b2AccountId', e.target.value)}
            placeholder="Enter B2 Account ID"
          />
          {errors.b2AccountId && <span className="error">{errors.b2AccountId}</span>}
        </div>

        <div className="form-group">
          <label>Application Key</label>
          <input
            type="password"
            value={config.b2ApplicationKey}
            onChange={(e) => handleInputChange('b2ApplicationKey', e.target.value)}
            placeholder="Enter B2 Application Key"
          />
          {errors.b2ApplicationKey && <span className="error">{errors.b2ApplicationKey}</span>}
        </div>

        <div className="form-group">
          <label>Bucket Name</label>
          <input
            type="text"
            value={config.b2BucketName}
            onChange={(e) => handleInputChange('b2BucketName', e.target.value)}
            placeholder="Enter B2 Bucket Name"
          />
          {errors.b2BucketName && <span className="error">{errors.b2BucketName}</span>}
        </div>

        <button
          onClick={testB2Connection}
          disabled={!config.b2AccountId || !config.b2ApplicationKey || !config.b2BucketName || testing.b2}
          className="test-button"
        >
          {testing.b2 ? 'Testing...' : 'Test B2 Connection'}
        </button>
        {errors.b2 && <div className="error-message">{errors.b2}</div>}
      </section>

      <section className="config-section">
        <h3>Migration Options</h3>
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={config.testMode}
              onChange={(e) => handleInputChange('testMode', e.target.checked)}
            />
            Test Mode (process limited assets for validation)
          </label>
        </div>

        {config.testMode && (
          <div className="form-group">
            <label>Number of Assets to Process (max 50)</label>
            <input
              type="number"
              min="1"
              max="50"
              value={config.testAssetLimit}
              onChange={(e) => handleInputChange('testAssetLimit', parseInt(e.target.value))}
            />
          </div>
        )}
      </section>

      {errors.general && <div className="error-message general-error">{errors.general}</div>}

      <button
        onClick={handleStartMigration}
        className="start-button"
        disabled={!oauthState.authenticated || Object.keys(errors).filter(k => k !== 'general').length > 0}
      >
        Start Migration
      </button>
    </div>
  );
}

export default ConfigurationScreen;
