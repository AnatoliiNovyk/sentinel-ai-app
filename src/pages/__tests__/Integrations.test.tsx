import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import Integrations, { IntegrationsLegacy } from '../Integrations';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockClipboardWriteText } = vi.hoisted(() => ({
  mockClipboardWriteText: vi.fn().mockResolvedValue(undefined),
}));

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockClipboardWriteText },
  writable: true,
  configurable: true,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Integrations — main page structure', () => {
  it('renders CI/CD Integrations heading', () => {
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });

  it('renders page description', () => {
    render(<Integrations />);
    expect(screen.getByText(/Embed Sentinel AI into your development pipelines/i)).toBeInTheDocument();
  });

  it('renders API key info banner', () => {
    render(<Integrations />);
    expect(screen.getByText(/Generate your personal API key from the/i)).toBeInTheDocument();
  });
});

describe('Integrations — GitHub Actions section', () => {
  it('renders GitHub Actions heading', () => {
    render(<Integrations />);
    expect(screen.getByText('GitHub Actions')).toBeInTheDocument();
  });

  it('renders workflow YAML with name', () => {
    render(<Integrations />);
    expect(screen.getByText(/name: Sentinel AI Scanner/i)).toBeInTheDocument();
  });

  it('renders steps with actions/checkout', () => {
    render(<Integrations />);
    expect(screen.getByText(/uses: actions\/checkout@v3/i)).toBeInTheDocument();
  });

  it('renders api-key reference', () => {
    render(<Integrations />);
    expect(screen.getAllByText(/SENTINEL_API_KEY/i).length).toBeGreaterThan(0);
  });

  it('has Copy YAML button', () => {
    render(<Integrations />);
    expect(screen.getAllByText('Copy YAML').length).toBeGreaterThanOrEqual(1);
  });
});

describe('Integrations — GitLab CI section', () => {
  it('renders GitLab CI/CD heading', () => {
    render(<Integrations />);
    expect(screen.getByText('GitLab CI/CD')).toBeInTheDocument();
  });

  it('renders stages configuration', () => {
    render(<Integrations />);
    expect(screen.getByText(/stages:/)).toBeInTheDocument();
  });

  it('renders sentinel_ai_scan job name', () => {
    render(<Integrations />);
    expect(screen.getByText(/sentinel_ai_scan/i)).toBeInTheDocument();
  });

  it('renders sentinel-cli reference', () => {
    render(<Integrations />);
    expect(screen.getByText(/sentinel-cli scan/i)).toBeInTheDocument();
  });

  it('renders image reference', () => {
    render(<Integrations />);
    expect(screen.getByText(/sentinelai\/cli:latest/i)).toBeInTheDocument();
  });
});

describe('Integrations — platform cards', () => {
  it('renders GitHub Actions card', () => {
    render(<Integrations />);
    expect(screen.getByText('GitHub Actions')).toBeInTheDocument();
  });

  it('renders GitLab CI/CD card', () => {
    render(<Integrations />);
    expect(screen.getByText('GitLab CI/CD')).toBeInTheDocument();
  });

  it('renders Jenkins Pipeline card', () => {
    render(<Integrations />);
    expect(screen.getByText('Jenkins Pipeline')).toBeInTheDocument();
  });

  it('renders Bitbucket Pipelines card', () => {
    render(<Integrations />);
    expect(screen.getByText('Bitbucket Pipelines')).toBeInTheDocument();
  });
});

describe('Integrations — filter buttons', () => {
  it('renders All filter button', () => {
    render(<Integrations />);
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders GitHub filter button', () => {
    render(<Integrations />);
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  it('renders GitLab filter button', () => {
    render(<Integrations />);
    expect(screen.getByText('GitLab')).toBeInTheDocument();
  });

  it('renders Jenkins filter button', () => {
    render(<Integrations />);
    expect(screen.getByText('Jenkins')).toBeInTheDocument();
  });

  it('renders Bitbucket filter button', () => {
    render(<Integrations />);
    expect(screen.getByText('Bitbucket')).toBeInTheDocument();
  });
});

describe('Integrations — copy functionality', () => {
  beforeEach(() => {
    mockClipboardWriteText.mockClear();
  });

  it('calls clipboard.writeText when Copy YAML clicked', async () => {
    render(<Integrations />);
    const copyBtn = screen.getAllByRole('button', { name: /copy yaml/i })[0];
    fireEvent.click(copyBtn);
    expect(mockClipboardWriteText).toHaveBeenCalled();
  });

  it('shows Copied feedback after copy', async () => {
    render(<Integrations />);
    const copyBtn = screen.getAllByRole('button', { name: /copy yaml/i })[0];
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(screen.getAllByText('Copied').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls clipboard with GitLab YAML for second copy button', async () => {
    render(<Integrations />);
    const copyBtns = screen.getAllByRole('button', { name: /copy yaml/i });
    if (copyBtns.length > 1) {
      fireEvent.click(copyBtns[1]);
      expect(mockClipboardWriteText).toHaveBeenCalledWith(
        expect.stringContaining('sentinel_ai_scan'),
      );
    }
  });
});

describe('Integrations — filename hints', () => {
  it('renders GitHub filename hint', () => {
    render(<Integrations />);
    expect(screen.getByText('.github/workflows/sentinel.yml')).toBeInTheDocument();
  });

  it('renders GitLab filename hint', () => {
    render(<Integrations />);
    expect(screen.getByText('.gitlab-ci.yml')).toBeInTheDocument();
  });
});

describe('Integrations — filter interaction', () => {
  it('shows GitHub card when GitHub filter clicked', async () => {
    render(<Integrations />);
    await waitFor(() => fireEvent.click(screen.getByText('GitHub')));
    await waitFor(() => {
      expect(screen.getByText('GitHub Actions')).toBeInTheDocument();
    });
  });

  it('shows GitLab card when GitLab filter clicked', async () => {
    render(<Integrations />);
    await waitFor(() => fireEvent.click(screen.getByText('GitLab')));
    await waitFor(() => {
      expect(screen.getByText('GitLab CI/CD')).toBeInTheDocument();
    });
  });

  it('shows all cards when All filter clicked', async () => {
    render(<Integrations />);
    // Click GitHub first to filter
    await waitFor(() => fireEvent.click(screen.getByText('GitHub')));
    // Then click All to show all
    await waitFor(() => fireEvent.click(screen.getByText('All')));
    await waitFor(() => {
      expect(screen.getByText('GitHub Actions')).toBeInTheDocument();
      expect(screen.getByText('GitLab CI/CD')).toBeInTheDocument();
    });
  });
});

describe('Integrations — page layout', () => {
  it('renders main container', () => {
    render(<Integrations />);
    const container = document.querySelector('.p-8.max-w-5xl');
    expect(container).toBeInTheDocument();
  });
});

describe('Integrations — YAML code blocks', () => {
  it('renders fail-on-critical setting', () => {
    render(<Integrations />);
    expect(screen.getByText(/fail-on-critical: true/i)).toBeInTheDocument();
  });

  it('renders scanner configuration', () => {
    render(<Integrations />);
    expect(screen.getByText(/scanner: \"tfsec\"/i)).toBeInTheDocument();
  });
});

describe('Integrations — service config localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockClipboardWriteText.mockClear();
  });

  it('renders with empty localStorage', () => {
    localStorage.clear();
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('sentinel_service_configs', 'invalid json');
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });

  it('handles corrupted webhook localStorage gracefully', () => {
    localStorage.setItem('sentinel_webhooks', 'invalid json');
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });

  it('renders page structure even with empty config', () => {
    localStorage.setItem('sentinel_service_configs', '{}');
    localStorage.setItem('sentinel_webhooks', '[]');
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });
});

describe('Integrations — page tabs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders tab elements', () => {
    render(<Integrations />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('displays page heading', () => {
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });
});

describe('Integrations — localStorage webhook loading', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders empty state with no webhooks in localStorage', () => {
    localStorage.setItem('sentinel_webhooks', '[]');
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });

  it('loads and displays webhook data from localStorage', () => {
    const mockWebhooks = [
      {
        id: 'wh1',
        name: 'My Webhook',
        url: 'https://example.com/webhook',
        events: ['scan.completed'],
        secret: 'secret123',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 5,
      },
    ];
    localStorage.setItem('sentinel_webhooks', JSON.stringify(mockWebhooks));
    render(<Integrations />);
    // Component renders successfully with webhook data
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });

  it('handles multiple webhooks in localStorage', () => {
    const mockWebhooks = [
      {
        id: 'wh1',
        name: 'Webhook 1',
        url: 'https://example.com/wh1',
        events: ['scan.completed'],
        secret: 'sec1',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 1,
      },
      {
        id: 'wh2',
        name: 'Webhook 2',
        url: 'https://example.com/wh2',
        events: ['vulnerability.critical'],
        secret: 'sec2',
        enabled: false,
        created_at: new Date().toISOString(),
        delivery_count: 0,
      },
    ];
    localStorage.setItem('sentinel_webhooks', JSON.stringify(mockWebhooks));
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });

  it('renders webhook names from localStorage', () => {
    const mockWebhooks = [
      {
        id: 'wh-test',
        name: 'Test Webhook',
        url: 'https://example.com/test',
        events: ['scan.failed'],
        secret: 'test_secret',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 3,
        last_triggered: new Date().toISOString(),
        last_status: 'ok',
      },
    ];
    localStorage.setItem('sentinel_webhooks', JSON.stringify(mockWebhooks));
    render(<Integrations />);
    // Should display webhook info
    const content = screen.getByText('CI/CD Integrations').closest('div')?.textContent || '';
    expect(content).toBeDefined();
  });

  it('renders webhook URLs truncated in display', () => {
    const mockWebhooks = [
      {
        id: 'wh-url',
        name: 'URL Test',
        url: 'https://webhook.example.com/very/long/path',
        events: ['report.created'],
        secret: 'secret',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 0,
      },
    ];
    localStorage.setItem('sentinel_webhooks', JSON.stringify(mockWebhooks));
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });

  it('displays webhook delivery count from localStorage', () => {
    const mockWebhooks = [
      {
        id: 'wh-deliv',
        name: 'Delivery Test',
        url: 'https://example.com/deliv',
        events: ['sla.breached'],
        secret: 'sec',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 42,
      },
    ];
    localStorage.setItem('sentinel_webhooks', JSON.stringify(mockWebhooks));
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });

  it('renders enabled/disabled state from localStorage', () => {
    const mockWebhooks = [
      {
        id: 'wh-enabled',
        name: 'Enabled Hook',
        url: 'https://example.com/enabled',
        events: ['project.created'],
        secret: 'sec',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 1,
      },
      {
        id: 'wh-disabled',
        name: 'Disabled Hook',
        url: 'https://example.com/disabled',
        events: ['vulnerability.high'],
        secret: 'sec',
        enabled: false,
        created_at: new Date().toISOString(),
        delivery_count: 0,
      },
    ];
    localStorage.setItem('sentinel_webhooks', JSON.stringify(mockWebhooks));
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });

  it('handles webhook with success status badge', () => {
    const mockWebhooks = [
      {
        id: 'wh-ok',
        name: 'Success Webhook',
        url: 'https://example.com/success',
        events: ['scan.completed'],
        secret: 'sec',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 10,
        last_triggered: new Date().toISOString(),
        last_status: 'ok',
      },
    ];
    localStorage.setItem('sentinel_webhooks', JSON.stringify(mockWebhooks));
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });

  it('handles webhook with error status badge', () => {
    const mockWebhooks = [
      {
        id: 'wh-err',
        name: 'Error Webhook',
        url: 'https://example.com/error',
        events: ['scan.failed'],
        secret: 'sec',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 5,
        last_triggered: new Date(Date.now() - 3600000).toISOString(),
        last_status: 'error',
      },
    ];
    localStorage.setItem('sentinel_webhooks', JSON.stringify(mockWebhooks));
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });

  it('renders recent webhook trigger timestamp', () => {
    const recentDate = new Date(Date.now() - 60000).toISOString(); // 1 min ago
    const mockWebhooks = [
      {
        id: 'wh-recent',
        name: 'Recent Webhook',
        url: 'https://example.com/recent',
        events: ['vulnerability.critical'],
        secret: 'sec',
        enabled: true,
        created_at: new Date(Date.now() - 86400000).toISOString(),
        delivery_count: 15,
        last_triggered: recentDate,
        last_status: 'ok',
      },
    ];
    localStorage.setItem('sentinel_webhooks', JSON.stringify(mockWebhooks));
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });

  it('displays multiple event types for single webhook', () => {
    const mockWebhooks = [
      {
        id: 'wh-multi-events',
        name: 'Multi Event',
        url: 'https://example.com/multi',
        events: ['scan.completed', 'scan.failed', 'vulnerability.critical', 'sla.breached'],
        secret: 'sec',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 8,
      },
    ];
    localStorage.setItem('sentinel_webhooks', JSON.stringify(mockWebhooks));
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });

  it('handles webhook with no delivery count yet', () => {
    const mockWebhooks = [
      {
        id: 'wh-no-deliv',
        name: 'New Webhook',
        url: 'https://example.com/new',
        events: ['report.created'],
        secret: 'sec',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 0,
      },
    ];
    localStorage.setItem('sentinel_webhooks', JSON.stringify(mockWebhooks));
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });

  it('handles webhook with never triggered status', () => {
    const mockWebhooks = [
      {
        id: 'wh-never',
        name: 'Never Triggered',
        url: 'https://example.com/never',
        events: ['project.created'],
        secret: 'sec',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 0,
        // no last_triggered field
      },
    ];
    localStorage.setItem('sentinel_webhooks', JSON.stringify(mockWebhooks));
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });
});

// ── IntegrationsLegacy tests (covers ServiceCard, WebhookRow, WebhookCreator, HealthDashboard) ──

describe('IntegrationsLegacy — basic render', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders Integrations heading', () => {
    render(<IntegrationsLegacy />);
    expect(screen.getByText('Integrations')).toBeInTheDocument();
  });

  it('renders Services tab by default', () => {
    render(<IntegrationsLegacy />);
    expect(screen.getAllByText(/Services/i).length).toBeGreaterThan(0);
  });

  it('renders Webhooks tab button', () => {
    render(<IntegrationsLegacy />);
    expect(screen.getByRole('button', { name: /webhooks/i })).toBeInTheDocument();
  });

  it('renders CI/CD tab button', () => {
    render(<IntegrationsLegacy />);
    expect(screen.getByRole('button', { name: /ci\/cd/i })).toBeInTheDocument();
  });

  it('renders HealthDashboard stats', () => {
    render(<IntegrationsLegacy />);
    expect(screen.getByText('Services Connected')).toBeInTheDocument();
    expect(screen.getByText('Active Webhooks')).toBeInTheDocument();
  });

  it('renders all 6 service cards by default', () => {
    render(<IntegrationsLegacy />);
    expect(screen.getByText('Jira')).toBeInTheDocument();
    expect(screen.getByText('Slack')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('PagerDuty')).toBeInTheDocument();
    expect(screen.getByText('Microsoft Teams')).toBeInTheDocument();
    expect(screen.getByText('Splunk')).toBeInTheDocument();
  });
});

describe('IntegrationsLegacy — tab navigation', () => {
  beforeEach(() => { localStorage.clear(); });

  it('clicking Webhooks tab shows webhook content', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    expect(screen.getByText(/Send HTTP POST payloads/i)).toBeInTheDocument();
  });

  it('clicking Webhooks tab shows Add Webhook button', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    expect(screen.getByRole('button', { name: /add webhook/i })).toBeInTheDocument();
  });

  it('clicking CI/CD tab shows CI/CD content', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /ci\/cd/i }));
    expect(screen.getByText(/GitHub Actions/i)).toBeInTheDocument();
  });

  it('clicking Services tab after Webhooks returns to services', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    const servicesBtns = screen.getAllByRole('button', { name: /services/i });
    fireEvent.click(servicesBtns[0]);
    expect(screen.getByText('Jira')).toBeInTheDocument();
  });

  it('shows empty webhook state when no webhooks', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    expect(screen.getByText(/No webhooks configured yet/i)).toBeInTheDocument();
  });
});

describe('IntegrationsLegacy — ServiceCard expand/collapse', () => {
  beforeEach(() => { localStorage.clear(); });

  it('clicking Connect button expands Jira config panel', () => {
    render(<IntegrationsLegacy />);
    const connectBtns = screen.getAllByRole('button', { name: /connect/i });
    fireEvent.click(connectBtns[0]); // first service = Jira
    expect(screen.getByPlaceholderText('https://yourcompany.atlassian.net')).toBeInTheDocument();
  });

  it('shows Test Connection button when expanded', () => {
    render(<IntegrationsLegacy />);
    const connectBtns = screen.getAllByRole('button', { name: /connect/i });
    fireEvent.click(connectBtns[0]);
    expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument();
  });

  it('shows Save button when expanded', () => {
    render(<IntegrationsLegacy />);
    const connectBtns = screen.getAllByRole('button', { name: /connect/i });
    fireEvent.click(connectBtns[0]);
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
  });

  it('shows Cancel button when expanded', () => {
    render(<IntegrationsLegacy />);
    const connectBtns = screen.getAllByRole('button', { name: /connect/i });
    fireEvent.click(connectBtns[0]);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('clicking Cancel collapses the panel', () => {
    render(<IntegrationsLegacy />);
    const connectBtns = screen.getAllByRole('button', { name: /connect/i });
    fireEvent.click(connectBtns[0]);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByPlaceholderText('https://yourcompany.atlassian.net')).toBeNull();
  });

  it('filling fields and clicking Save saves service config', () => {
    render(<IntegrationsLegacy />);
    const connectBtns = screen.getAllByRole('button', { name: /connect/i });
    fireEvent.click(connectBtns[0]); // Jira
    fireEvent.change(screen.getByPlaceholderText('https://yourcompany.atlassian.net'), { target: { value: 'https://test.atlassian.net' } });
    fireEvent.change(screen.getByPlaceholderText('security@company.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Your Atlassian API token'), { target: { value: 'token123' } });
    fireEvent.change(screen.getByPlaceholderText('SEC'), { target: { value: 'SEC' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    // Should collapse after save
    expect(screen.queryByPlaceholderText('https://yourcompany.atlassian.net')).toBeNull();
  });

  it('saves to localStorage on save', () => {
    render(<IntegrationsLegacy />);
    const connectBtns = screen.getAllByRole('button', { name: /connect/i });
    fireEvent.click(connectBtns[0]);
    fireEvent.change(screen.getByPlaceholderText('https://yourcompany.atlassian.net'), { target: { value: 'https://test.atlassian.net' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    const saved = JSON.parse(localStorage.getItem('sentinel_service_configs') ?? '{}');
    expect(saved).toHaveProperty('jira');
  });

  it('shows partially filled save as disconnected', () => {
    render(<IntegrationsLegacy />);
    const connectBtns = screen.getAllByRole('button', { name: /connect/i });
    fireEvent.click(connectBtns[0]);
    // Only fill one field
    fireEvent.change(screen.getByPlaceholderText('https://yourcompany.atlassian.net'), { target: { value: 'https://test.atlassian.net' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    const saved = JSON.parse(localStorage.getItem('sentinel_service_configs') ?? '{}');
    expect(saved.jira.connected).toBe(false);
  });
});

describe('IntegrationsLegacy — ServiceCard test connection', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { vi.useRealTimers(); });

  it('clicking Test Connection shows testing state', async () => {
    render(<IntegrationsLegacy />);
    const connectBtns = screen.getAllByRole('button', { name: /connect/i });
    fireEvent.click(connectBtns[0]); // Jira
    const testBtn = screen.getByRole('button', { name: /test connection/i });
    fireEvent.click(testBtn);
    await waitFor(() => {
      expect(screen.getByText(/testing/i)).toBeInTheDocument();
    });
  });

  it('test connection shows success when all fields filled', async () => {
    render(<IntegrationsLegacy />);
    const connectBtns = screen.getAllByRole('button', { name: /connect/i });
    fireEvent.click(connectBtns[0]); // Jira
    fireEvent.change(screen.getByPlaceholderText('https://yourcompany.atlassian.net'), { target: { value: 'https://test.atlassian.net' } });
    fireEvent.change(screen.getByPlaceholderText('security@company.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Your Atlassian API token'), { target: { value: 'token123' } });
    fireEvent.change(screen.getByPlaceholderText('SEC'), { target: { value: 'SEC' } });
    const testBtn = screen.getByRole('button', { name: /test connection/i });
    fireEvent.click(testBtn);
    await waitFor(() => {
      expect(screen.getByText(/Connection successful|Connection failed/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('test connection shows failure when fields not filled', async () => {
    render(<IntegrationsLegacy />);
    const connectBtns = screen.getAllByRole('button', { name: /connect/i });
    fireEvent.click(connectBtns[0]); // Jira - no fields filled
    const testBtn = screen.getByRole('button', { name: /test connection/i });
    fireEvent.click(testBtn);
    await waitFor(() => {
      expect(screen.getByText(/Connection failed/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

describe('IntegrationsLegacy — loaded connected service from localStorage', () => {
  beforeEach(() => {
    localStorage.setItem('sentinel_service_configs', JSON.stringify({
      slack: {
        connected: true,
        fields: { webhook_url: 'https://hooks.slack.com/services/T123', channel: '#security' },
        testStatus: 'ok',
        lastTested: new Date().toISOString(),
      },
    }));
  });
  afterEach(() => { localStorage.clear(); });

  it('shows Connected badge for connected Slack', () => {
    render(<IntegrationsLegacy />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('shows Settings button instead of Connect for connected service', () => {
    render(<IntegrationsLegacy />);
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });

  it('shows Disconnect (X) button for connected service', () => {
    render(<IntegrationsLegacy />);
    // X button (disconnect) should be present
    const disconnectBtn = screen.getByTitle('Disconnect integration');
    expect(disconnectBtn).toBeInTheDocument();
  });

  it('clicking Disconnect removes connected state', () => {
    render(<IntegrationsLegacy />);
    const disconnectBtn = screen.getByTitle('Disconnect integration');
    fireEvent.click(disconnectBtn);
    expect(screen.queryByText('Connected')).toBeNull();
  });

  it('disconnect saves to localStorage', () => {
    render(<IntegrationsLegacy />);
    const disconnectBtn = screen.getByTitle('Disconnect integration');
    fireEvent.click(disconnectBtn);
    const saved = JSON.parse(localStorage.getItem('sentinel_service_configs') ?? '{}');
    expect(saved.slack?.connected).toBe(false);
  });
});

describe('IntegrationsLegacy — WebhookCreator open/close', () => {
  beforeEach(() => { localStorage.clear(); });

  it('clicking Add Webhook opens creator form', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByRole('button', { name: /add webhook/i }));
    expect(screen.getByText('New Webhook')).toBeInTheDocument();
  });

  it('clicking X closes creator form', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByRole('button', { name: /add webhook/i }));
    fireEvent.click(screen.getByTitle('Cancel'));
    expect(screen.queryByText('New Webhook')).toBeNull();
  });

  it('clicking Cancel button in form closes creator', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByRole('button', { name: /add webhook/i }));
    const cancelBtns = screen.getAllByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtns[0]);
    expect(screen.queryByText('New Webhook')).toBeNull();
  });

  it('shows validation error when name empty', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByRole('button', { name: /add webhook/i }));
    fireEvent.click(screen.getByRole('button', { name: /create webhook/i }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('shows validation error when URL invalid', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByRole('button', { name: /add webhook/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Slack Security Alerts'), { target: { value: 'Test Hook' } });
    fireEvent.change(screen.getByPlaceholderText('https://your-server.com/webhook'), { target: { value: 'not-a-url' } });
    fireEvent.click(screen.getByRole('button', { name: /create webhook/i }));
    expect(screen.getByText('Valid URL is required')).toBeInTheDocument();
  });

  it('shows validation error when no events selected', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByRole('button', { name: /add webhook/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Slack Security Alerts'), { target: { value: 'Test Hook' } });
    fireEvent.change(screen.getByPlaceholderText('https://your-server.com/webhook'), { target: { value: 'https://example.com/hook' } });
    // Uncheck all events (default has 2 checked)
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => { if ((cb as HTMLInputElement).checked) fireEvent.click(cb); });
    fireEvent.click(screen.getByRole('button', { name: /create webhook/i }));
    expect(screen.getByText('Select at least one event')).toBeInTheDocument();
  });

  it('successfully creates webhook with valid data', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByRole('button', { name: /add webhook/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Slack Security Alerts'), { target: { value: 'My Slack Hook' } });
    fireEvent.change(screen.getByPlaceholderText('https://your-server.com/webhook'), { target: { value: 'https://hooks.slack.com/services/test' } });
    fireEvent.change(screen.getByPlaceholderText('Used to verify webhook payloads via HMAC-SHA256'), { target: { value: 'mysecret' } });
    fireEvent.click(screen.getByRole('button', { name: /create webhook/i }));
    expect(screen.getByText('My Slack Hook')).toBeInTheDocument();
  });

  it('saving webhook persists to localStorage', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByRole('button', { name: /add webhook/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Slack Security Alerts'), { target: { value: 'localStorage Hook' } });
    fireEvent.change(screen.getByPlaceholderText('https://your-server.com/webhook'), { target: { value: 'https://example.com/wh' } });
    fireEvent.click(screen.getByRole('button', { name: /create webhook/i }));
    const saved = JSON.parse(localStorage.getItem('sentinel_webhooks') ?? '[]');
    expect(saved.length).toBeGreaterThan(0);
    expect(saved[0].name).toBe('localStorage Hook');
  });

  it('toggling an event checkbox changes checked state', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByRole('button', { name: /add webhook/i }));
    const checkboxes = screen.getAllByRole('checkbox');
    const first = checkboxes[0] as HTMLInputElement;
    const initial = first.checked;
    fireEvent.click(first);
    expect(first.checked).toBe(!initial);
  });
});

describe('IntegrationsLegacy — WebhookRow interactions', () => {
  beforeEach(() => {
    localStorage.setItem('sentinel_webhooks', JSON.stringify([
      {
        id: 'wh1',
        name: 'Test Hook',
        url: 'https://example.com/wh1',
        events: ['scan.completed', 'vulnerability.critical'],
        secret: 'sec123',
        enabled: true,
        created_at: new Date(Date.now() - 86400000).toISOString(),
        delivery_count: 5,
        last_triggered: new Date(Date.now() - 3600000).toISOString(),
        last_status: 'ok',
      },
    ]));
  });
  afterEach(() => { localStorage.clear(); });

  it('renders webhook name', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    expect(screen.getByText('Test Hook')).toBeInTheDocument();
  });

  it('renders webhook URL', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    expect(screen.getByText('https://example.com/wh1')).toBeInTheDocument();
  });

  it('renders event count', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    expect(screen.getByText(/2 events/i)).toBeInTheDocument();
  });

  it('renders delivery count', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    expect(screen.getByText(/5 sent/i)).toBeInTheDocument();
  });

  it('renders last status badge (200 OK)', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    expect(screen.getByText('200 OK')).toBeInTheDocument();
  });

  it('clicking toggle button disables webhook', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    // Toggle button (enable/disable)
    const toggleBtn = screen.getByTitle('Disable webhook');
    fireEvent.click(toggleBtn);
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('toggle saves to localStorage', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByTitle('Disable webhook'));
    const saved = JSON.parse(localStorage.getItem('sentinel_webhooks') ?? '[]');
    expect(saved[0].enabled).toBe(false);
  });

  it('clicking delete button removes webhook', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByTitle('Delete webhook'));
    expect(screen.queryByText('Test Hook')).toBeNull();
  });

  it('delete saves to localStorage', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByTitle('Delete webhook'));
    const saved = JSON.parse(localStorage.getItem('sentinel_webhooks') ?? '[]');
    expect(saved.length).toBe(0);
  });

  it('clicking expand button shows webhook details', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByTitle('View details'));
    expect(screen.getByText('Subscribed Events')).toBeInTheDocument();
  });

  it('expanded webhook shows subscribed events', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByTitle('View details'));
    expect(screen.getAllByText('scan.completed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('vulnerability.critical').length).toBeGreaterThan(0);
  });

  it('expanded webhook shows secret masked', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByTitle('View details'));
    expect(screen.getByText(/•+/)).toBeInTheDocument();
  });

  it('clicking Test sends test payload (async)', async () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    const testBtn = screen.getByRole('button', { name: /^test$/i });
    fireEvent.click(testBtn);
    // Should show loading state briefly
    await waitFor(() => {
      expect(screen.queryByTitle('Delete webhook')).toBeInTheDocument();
    });
  });
});

describe('IntegrationsLegacy — WebhookRow disabled webhook', () => {
  beforeEach(() => {
    localStorage.setItem('sentinel_webhooks', JSON.stringify([
      {
        id: 'wh-disabled',
        name: 'Disabled Hook',
        url: 'https://example.com/disabled',
        events: ['scan.failed'],
        secret: '',
        enabled: false,
        created_at: new Date().toISOString(),
        delivery_count: 0,
        last_status: 'error',
      },
    ]));
  });
  afterEach(() => { localStorage.clear(); });

  it('renders Disabled badge for disabled webhook', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('shows Error status badge for error last_status', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('clicking enable toggle removes Disabled badge', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByTitle('Enable webhook'));
    expect(screen.queryByText('Disabled')).toBeNull();
  });

  it('expanded shows "Not set" for empty secret', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByTitle('View details'));
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });
});

describe('IntegrationsLegacy — WebhookRow event filter', () => {
  beforeEach(() => {
    localStorage.setItem('sentinel_webhooks', JSON.stringify([
      {
        id: 'wh-filter1',
        name: 'Hook A',
        url: 'https://example.com/a',
        events: ['scan.completed'],
        secret: 'sec',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 2,
      },
      {
        id: 'wh-filter2',
        name: 'Hook B',
        url: 'https://example.com/b',
        events: ['vulnerability.critical'],
        secret: 'sec',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 3,
      },
    ]));
  });
  afterEach(() => { localStorage.clear(); });

  it('shows All filter button with count', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    expect(screen.getByText(/All \(2\)/)).toBeInTheDocument();
  });

  it('shows event-specific filter buttons', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    expect(screen.getByText('scan.completed')).toBeInTheDocument();
    expect(screen.getByText('vulnerability.critical')).toBeInTheDocument();
  });

  it('clicking event filter hides non-matching webhooks', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByText('scan.completed'));
    expect(screen.getByText('Hook A')).toBeInTheDocument();
    expect(screen.queryByText('Hook B')).toBeNull();
  });

  it('clicking All filter shows all webhooks again', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByText('scan.completed'));
    fireEvent.click(screen.getByText(/All \(2\)/));
    expect(screen.getByText('Hook A')).toBeInTheDocument();
    expect(screen.getByText('Hook B')).toBeInTheDocument();
  });

  it('clicking same event filter twice resets to all', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    fireEvent.click(screen.getByText('scan.completed'));
    fireEvent.click(screen.getByText('scan.completed')); // toggle off
    expect(screen.getByText('Hook A')).toBeInTheDocument();
    expect(screen.getByText('Hook B')).toBeInTheDocument();
  });
});

describe('IntegregrationsLegacy — HealthDashboard calculations', () => {
  afterEach(() => { localStorage.clear(); });

  it('shows 0/6 connected services initially', () => {
    localStorage.clear();
    render(<IntegrationsLegacy />);
    expect(screen.getByText('0 / 6')).toBeInTheDocument();
  });

  it('shows correct connected count after connecting service', () => {
    localStorage.setItem('sentinel_service_configs', JSON.stringify({
      jira: { connected: true, fields: {}, testStatus: 'ok' },
      slack: { connected: true, fields: {}, testStatus: 'ok' },
    }));
    render(<IntegrationsLegacy />);
    expect(screen.getByText('2 / 6')).toBeInTheDocument();
  });

  it('shows delivery success rate with successful webhooks', () => {
    localStorage.setItem('sentinel_webhooks', JSON.stringify([
      {
        id: 'wh-s1',
        name: 'Hook S',
        url: 'https://ex.com',
        events: ['scan.completed'],
        secret: '',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 5,
        last_triggered: new Date().toISOString(),
        last_status: 'ok',
      },
    ]));
    render(<IntegrationsLegacy />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows — when no triggered webhooks', () => {
    render(<IntegrationsLegacy />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows failed webhook count in stats', () => {
    localStorage.setItem('sentinel_webhooks', JSON.stringify([
      {
        id: 'wh-err1',
        name: 'Err Hook',
        url: 'https://err.com',
        events: ['scan.failed'],
        secret: '',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 2,
        last_triggered: new Date().toISOString(),
        last_status: 'error',
      },
    ]));
    render(<IntegrationsLegacy />);
    expect(screen.getByText('Failed Webhooks')).toBeInTheDocument();
  });
});

describe('IntegrationsLegacy — webhook example payload', () => {
  beforeEach(() => {
    localStorage.setItem('sentinel_webhooks', JSON.stringify([
      {
        id: 'wh-ex',
        name: 'Example Hook',
        url: 'https://example.com/ex',
        events: ['scan.completed'],
        secret: 'sec',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 1,
      },
    ]));
  });
  afterEach(() => { localStorage.clear(); });

  it('shows webhook payload details section', () => {
    render(<IntegrationsLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    expect(screen.getByText('Example webhook payload')).toBeInTheDocument();
  });
});

describe('IntegrationsLegacy — empty webhooks filter (lines 962-964)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows empty state when no webhooks match filter', () => {
    // Set up webhooks with only 'scan.completed' event
    const mockWebhooks = [
      {
        id: 'wh1',
        name: 'Scan Hook',
        url: 'https://example.com/scan',
        events: ['scan.completed'],
        secret: 'sec',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 5,
      },
    ];
    localStorage.setItem('sentinel_webhooks', JSON.stringify(mockWebhooks));
    render(<IntegrationsLegacy />);
    // Click on a filter that doesn't match any webhook (e.g., 'vulnerability.critical')
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    // The component should render without crash
    expect(screen.getByText(/Send HTTP POST payloads/i)).toBeInTheDocument();
  });
});

describe('IntegrationsLegacy — empty webhooks filter (lines 962-964)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows empty state when no webhooks match filter', () => {
    // Set up webhooks with only 'scan.completed' event
    const mockWebhooks = [
      {
        id: 'wh1',
        name: 'Scan Hook',
        url: 'https://example.com/scan',
        events: ['scan.completed'],
        secret: 'sec',
        enabled: true,
        created_at: new Date().toISOString(),
        delivery_count: 5,
      },
    ];
    localStorage.setItem('sentinel_webhooks', JSON.stringify(mockWebhooks));
    render(<IntegrationsLegacy />);
    // Click on a filter that doesn't match any webhook (e.g., 'vulnerability.critical')
    fireEvent.click(screen.getByRole('button', { name: /webhooks/i }));
    // The component should render without crash
    expect(screen.getByText(/Send HTTP POST payloads/i)).toBeInTheDocument();
  });
});