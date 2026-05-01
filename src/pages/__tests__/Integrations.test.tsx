import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Integrations from '../Integrations';

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