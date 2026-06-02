import { useEffect, useState } from 'react';

interface HealthResponse {
  status: string;
  service: string;
  uptimeSeconds: number;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: HealthResponse) => setHealth(data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'));
  }, []);

  return (
    <main>
      <h1>F&amp;B + Retail AI Assistant</h1>
      <p>Hello world — the web app is running. This is the Phase 0 skeleton.</p>

      <section>
        <h2>API connection</h2>
        {health ? (
          <p data-testid="api-status">
            API: <strong>{health.status}</strong> (uptime {health.uptimeSeconds}s)
          </p>
        ) : error ? (
          <p data-testid="api-error">API unreachable: {error}</p>
        ) : (
          <p data-testid="api-loading">Checking API…</p>
        )}
      </section>
    </main>
  );
}

export default App;
