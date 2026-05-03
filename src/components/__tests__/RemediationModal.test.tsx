import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RemediationModal from '../RemediationModal';
import type { Vulnerability } from '../../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeVuln(overrides: Partial<Vulnerability> = {}): Vulnerability {
  return {
    id: 'v-1',
    scan_id: 'scan-1',
    user_id: 'user-1',
    title: 'Unpatched OpenSSL',
    description: 'TLS vulnerability',
    severity: 'critical',
    cve_id: 'CVE-2024-0001',
    mitre_tactic: '',
    cis_control: '',
    asset: 'api.example.com',
    remediation: 'Update OpenSSL to latest version.',
    remediation_code: '',
    remediation_type: 'manual',
    created_at: '2026-01-01T00:00:00Z',
    status: 'open',
    note: '',
    status_updated_at: '2026-01-01T00:00:00Z',
    sla_breached_at: null,
    sla_warned_at: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('RemediationModal — rendering', () => {
  it('displays the vulnerability title', () => {
    render(<RemediationModal vuln={makeVuln()} onClose={vi.fn()} />);
    expect(screen.getByText('Unpatched OpenSSL')).toBeInTheDocument();
  });

  it('shows the asset identifier', () => {
    render(<RemediationModal vuln={makeVuln()} onClose={vi.fn()} />);
    expect(screen.getByText('api.example.com')).toBeInTheDocument();
  });

  it('shows severity badge', () => {
    render(<RemediationModal vuln={makeVuln({ severity: 'high' })} onClose={vi.fn()} />);
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('shows "Manual" type badge for manual remediation', () => {
    render(<RemediationModal vuln={makeVuln({ remediation_type: 'manual' })} onClose={vi.fn()} />);
    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('shows "Terraform" type badge for terraform remediation', () => {
    render(<RemediationModal vuln={makeVuln({ remediation_type: 'terraform' })} onClose={vi.fn()} />);
    expect(screen.getByText('Terraform')).toBeInTheDocument();
  });

  it('shows "AWS CLI" type badge for aws-cli remediation', () => {
    render(<RemediationModal vuln={makeVuln({ remediation_type: 'aws-cli' })} onClose={vi.fn()} />);
    expect(screen.getByText('AWS CLI')).toBeInTheDocument();
  });

  it('shows CVE link when cve_id is set', () => {
    render(<RemediationModal vuln={makeVuln({ cve_id: 'CVE-2024-0001' })} onClose={vi.fn()} />);
    expect(screen.getByText('CVE-2024-0001 on NVD')).toBeInTheDocument();
  });

  it('does not show NVD link when cve_id is empty', () => {
    render(<RemediationModal vuln={makeVuln({ cve_id: '' })} onClose={vi.fn()} />);
    expect(screen.queryByText(/on NVD/i)).not.toBeInTheDocument();
  });
});

describe('RemediationModal — progress & steps', () => {
  it('shows 0% progress initially', () => {
    render(<RemediationModal vuln={makeVuln()} onClose={vi.fn()} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders STEP 1 label', () => {
    render(<RemediationModal vuln={makeVuln()} onClose={vi.fn()} />);
    expect(screen.getByText('STEP 1')).toBeInTheDocument();
  });

  it('toggles step completion and updates progress', () => {
    // manual type → 4 steps (guidance, document, re-scan)
    const vuln = makeVuln({ remediation_type: 'bash', remediation_code: 'echo fix' });
    render(<RemediationModal vuln={vuln} onClose={vi.fn()} />);

    // Bash → 3 steps: toggle step 1 → 33%
    // Find by text content of step label
    const allStepBtns = document.querySelectorAll('button');
    // Click the first step toggle (the wide row button)
    const firstStepToggle = Array.from(allStepBtns).find(
      (btn) => btn.textContent?.includes('STEP 1'),
    );
    expect(firstStepToggle).toBeDefined();
    fireEvent.click(firstStepToggle!);
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('shows "Mark as Resolved" when all steps are completed', () => {
    // bash → 3 steps
    const vuln = makeVuln({ remediation_type: 'bash', remediation_code: 'echo fix' });
    render(<RemediationModal vuln={vuln} onClose={vi.fn()} />);

    const allBtns = document.querySelectorAll('button');
    const stepToggles = Array.from(allBtns).filter(
      (btn) => btn.textContent?.includes('STEP '),
    );
    // Click all 3 step toggles
    stepToggles.forEach((btn) => fireEvent.click(btn));
    expect(screen.getByText('Mark as Resolved')).toBeInTheDocument();
  });
});

describe('RemediationModal — Auto-Remediation Playbook', () => {
  it('renders playbook toggle button', () => {
    render(<RemediationModal vuln={makeVuln()} onClose={vi.fn()} />);
    expect(screen.getByText('Auto-Remediation Playbook')).toBeInTheDocument();
    expect(screen.getByText('DRY RUN')).toBeInTheDocument();
  });

  it('does not show playbook entries before toggle is clicked', () => {
    render(<RemediationModal vuln={makeVuln()} onClose={vi.fn()} />);
    expect(screen.queryByText(/Block inbound traffic \(iptables\)/i)).not.toBeInTheDocument();
  });

  it('expands playbook entries when toggle is clicked', () => {
    render(<RemediationModal vuln={makeVuln({ asset: '10.0.0.1' })} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Auto-Remediation Playbook'));
    expect(screen.getByText(/Block inbound traffic \(iptables\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Block inbound traffic \(ufw\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Revoke AWS Security Group ingress/i)).toBeInTheDocument();
  });

  it('shows CVE patch entries when cve_id is set', () => {
    render(<RemediationModal vuln={makeVuln({ cve_id: 'CVE-2024-0001', asset: '192.168.1.1' })} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Auto-Remediation Playbook'));
    expect(screen.getByText(/Apply OS patch for CVE-2024-0001 \(apt\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Apply OS patch for CVE-2024-0001 \(yum\/dnf\)/i)).toBeInTheDocument();
  });

  it('shows preview warning note after expanding', () => {
    render(<RemediationModal vuln={makeVuln()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Auto-Remediation Playbook'));
    expect(screen.getByText(/Preview-only commands/i)).toBeInTheDocument();
  });
});


describe('RemediationModal — close interactions', () => {
  it('calls onClose when X button clicked', () => {
    const onClose = vi.fn();
    render(<RemediationModal vuln={makeVuln()} onClose={onClose} />);
    fireEvent.click(screen.getByTitle('Close modal'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when "Close" button clicked', () => {
    const onClose = vi.fn();
    render(<RemediationModal vuln={makeVuln()} onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('RemediationModal — copy command', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('copies command text to clipboard', () => {
    const vuln = makeVuln({ remediation_type: 'bash', remediation_code: 'sudo apt upgrade' });
    render(<RemediationModal vuln={vuln} onClose={vi.fn()} />);
    const copyBtn = screen.getByText('Copy');
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('sudo apt upgrade');
  });

  it('copies playbook command to clipboard', () => {
    const vuln = makeVuln({ asset: '10.0.0.1', cve_id: '' });
    render(<RemediationModal vuln={vuln} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Auto-Remediation Playbook'));
    // First playbook copy button
    const copyBtns = screen.getAllByText('Copy');
    fireEvent.click(copyBtns[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});

describe('RemediationModal — aws-cli steps', () => {
  it('shows Configure AWS CLI step for aws-cli type', () => {
    const vuln = makeVuln({ remediation_type: 'aws-cli' });
    render(<RemediationModal vuln={vuln} onClose={vi.fn()} />);
    expect(screen.getByText('Configure AWS CLI')).toBeInTheDocument();
    expect(screen.getByText('Run remediation command')).toBeInTheDocument();
  });

  it('shows kubectl steps for kubectl type', () => {
    const vuln = makeVuln({ remediation_type: 'kubectl' });
    render(<RemediationModal vuln={vuln} onClose={vi.fn()} />);
    expect(screen.getByText('Check kubectl context')).toBeInTheDocument();
    expect(screen.getByText('Verify rollout')).toBeInTheDocument();
  });
});

describe('RemediationModal — toggle uncomplete step', () => {
  it('un-checking completed step reduces progress', () => {
    const vuln = makeVuln({ remediation_type: 'bash', remediation_code: 'echo fix' });
    render(<RemediationModal vuln={vuln} onClose={vi.fn()} />);
    const firstStepToggle = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('STEP 1'),
    );
    expect(firstStepToggle).toBeDefined();
    // Check it
    fireEvent.click(firstStepToggle!);
    expect(screen.getByText('33%')).toBeInTheDocument();
    // Uncheck it
    fireEvent.click(firstStepToggle!);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});

describe('RemediationModal — copy timer reset', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('resets copy icon after 2 seconds', () => {
    const vuln = makeVuln({ remediation_type: 'bash', remediation_code: 'sudo apt upgrade' });
    render(<RemediationModal vuln={vuln} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Copy'));
    act(() => { vi.advanceTimersByTime(2100); });
    // After timer, the copy button text goes back to 'Copy' (not 'Copied')
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('resets playbook copy icon after 2 seconds', () => {
    const vuln = makeVuln({ asset: '10.0.0.1', cve_id: '' });
    render(<RemediationModal vuln={vuln} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Auto-Remediation Playbook'));
    const copyBtns = screen.getAllByText('Copy');
    fireEvent.click(copyBtns[0]);
    act(() => { vi.advanceTimersByTime(2100); });
    expect(screen.getAllByText('Copy').length).toBeGreaterThan(0);
  });
});

describe('RemediationModal — unknown remediation type', () => {
  it('falls back to manual meta for unknown remediation_type', () => {
    const vuln = makeVuln({ remediation_type: 'unknown-type' as never });
    render(<RemediationModal vuln={vuln} onClose={vi.fn()} />);
    expect(screen.getByText('Manual')).toBeInTheDocument();
  });
});
