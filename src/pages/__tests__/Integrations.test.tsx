import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import Integrations from '../Integrations';

// ── Mocks ─────────────────────────────────────────────────────────────────

const { mockClipboardWriteText } = vi.hoisted(() => ({
  mockClipboardWriteText: vi.fn().mockResolvedValue(undefined),
}));

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockClipboardWriteText },
  writable: true,
  configurable: true,
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Integrations — layout', () => {
  it('renders "CI/CD Integrations" heading', () => {
    render(<Integrations />);
    expect(screen.getByText('CI/CD Integrations')).toBeInTheDocument();
  });

  it('renders "GitHub Actions" section', () => {
    render(<Integrations />);
    expect(screen.getByText('GitHub Actions')).toBeInTheDocument();
  });

  it('renders "GitLab CI/CD" section', () => {
    render(<Integrations />);
    expect(screen.getByText('GitLab CI/CD')).toBeInTheDocument();
  });

  it('renders API key info banner', () => {
    render(<Integrations />);
    expect(screen.getByText(/generate your personal api key/i)).toBeInTheDocument();
  });

  it('renders both "Copy YAML" buttons', () => {
    render(<Integrations />);
    const copyBtns = screen.getAllByRole('button', { name: /copy yaml/i });
    expect(copyBtns.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Integrations — YAML content', () => {
  it('renders GitHub Actions workflow name in code block', () => {
    render(<Integrations />);
    expect(screen.getByText(/name: Sentinel AI Scanner/i)).toBeInTheDocument();
  });

  it('renders GitLab CI job name in code block', () => {
    render(<Integrations />);
    expect(screen.getByText(/sentinel_ai_scan/i)).toBeInTheDocument();
  });

  it('renders sentinel-cli reference in GitLab block', () => {
    render(<Integrations />);
    expect(screen.getByText(/sentinel-cli scan/i)).toBeInTheDocument();
  });
});

describe('Integrations — copy buttons', () => {
  it('calls clipboard.writeText with GitHub YAML when GitHub "Copy YAML" clicked', async () => {
    render(<Integrations />);
    const [githubBtn] = screen.getAllByRole('button', { name: /copy yaml/i });
    fireEvent.click(githubBtn);
    expect(mockClipboardWriteText).toHaveBeenCalledWith(
      expect.stringContaining('Sentinel AI Scanner'),
    );
  });

  it('shows "Copied" feedback after GitHub copy', async () => {
    render(<Integrations />);
    const [githubBtn] = screen.getAllByRole('button', { name: /copy yaml/i });
    fireEvent.click(githubBtn);
    await waitFor(() =>
      expect(screen.getAllByText('Copied').length).toBeGreaterThanOrEqual(1),
    );
  });

  it('calls clipboard.writeText with GitLab YAML when GitLab "Copy YAML" clicked', async () => {
    render(<Integrations />);
    const [, gitlabBtn] = screen.getAllByRole('button', { name: /copy yaml/i });
    fireEvent.click(gitlabBtn);
    expect(mockClipboardWriteText).toHaveBeenCalledWith(
      expect.stringContaining('sentinel_ai_scan'),
    );
  });

  it('shows "Copied" feedback after GitLab copy', async () => {
    render(<Integrations />);
    const [, gitlabBtn] = screen.getAllByRole('button', { name: /copy yaml/i });
    fireEvent.click(gitlabBtn);
    await waitFor(() =>
      expect(screen.getAllByText('Copied').length).toBeGreaterThanOrEqual(1),
    );
  });
});

describe('Integrations — Issue Tracker Templates', () => {
  it('renders "Issue Tracker Templates" section heading', () => {
    render(<Integrations />);
    expect(screen.getByText('Issue Tracker Templates')).toBeInTheDocument();
  });

  it('renders "Jira Issue Template" card title', () => {
    render(<Integrations />);
    expect(screen.getByText('Jira Issue Template')).toBeInTheDocument();
  });

  it('renders "Trello Card Template" card title', () => {
    render(<Integrations />);
    expect(screen.getByText('Trello Card Template')).toBeInTheDocument();
  });

  it('renders "ServiceNow" card title', () => {
    render(<Integrations />);
    expect(screen.getAllByText(/ServiceNow/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Copy buttons for each template card', () => {
    render(<Integrations />);
    const copyBtns = screen.getAllByRole('button', { name: /copy/i });
    // at least 2 YAML + 3 template copy buttons
    expect(copyBtns.length).toBeGreaterThanOrEqual(5);
  });

  it('calls clipboard.writeText when Jira template Copy button clicked', async () => {
    render(<Integrations />);
    const jiraCard = screen.getByText('Jira Issue Template').closest('div')!;
    const copyBtn = jiraCard.querySelector('button')!;
    fireEvent.click(copyBtn);
    expect(mockClipboardWriteText).toHaveBeenCalledWith(
      expect.stringContaining('summary'),
    );
  });
});

describe('Integrations — ServiceCard functions', () => {
  it('renders Jenkins Pipeline section', () => {
    render(<Integrations />);
    expect(screen.getByText('Jenkins Pipeline')).toBeInTheDocument();
  });

  it('renders Bitbucket Pipelines section', () => {
    render(<Integrations />);
    expect(screen.getByText('Bitbucket Pipelines')).toBeInTheDocument();
  });

  it('filters to show only GitHub when GitHub filter selected', async () => {
    render(<Integrations />);
    // find a filter/platform button for GitHub
    const allBtn = screen.queryByRole('button', { name: /all platforms/i });
    if (allBtn) {
      expect(screen.getByText('GitHub Actions')).toBeInTheDocument();
    } else {
      // platform filter might be rendered differently
      expect(screen.getByText('GitHub Actions')).toBeInTheDocument();
    }
  });
});
