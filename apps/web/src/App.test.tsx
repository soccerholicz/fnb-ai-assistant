import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import App from './App';

function mockFetchOk() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', service: 'api', uptimeSeconds: 1 }),
    }),
  );
}

describe('<App />', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders the hello-world heading', async () => {
    mockFetchOk();
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/AI Assistant/i);
    // Flush the health-check effect so the async state update settles inside act().
    await waitFor(() => expect(screen.getByTestId('api-status')).toBeInTheDocument());
  });

  it('shows the API status once the health check resolves', async () => {
    mockFetchOk();
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('api-status')).toHaveTextContent('ok'));
  });
});
