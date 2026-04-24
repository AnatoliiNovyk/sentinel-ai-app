import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Compliance from '../Compliance';

const { mockEq } = vi.hoisted(() => ({
  mockEq: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: mockEq }),
    }),
  },
}));

vi.mock('../../context/useAuth', () => {
  const _user = { id: 'user-1' };
  const _profile = { email: 'admin@example.com', company: 'Acme Corp' };
  return { useAuth: () => ({ user: _user, profile: _profile }) };
});

vi.mock('../../lib/evidencePackage', () => ({
  buildEvidencePackage: vi.fn().mockReturnValue({}),
  buildEvidenceMarkdown: vi.fn().mockReturnValue('## Report'),
  printReportAsPDF: vi.fn(),
}));

vi.mock('../../lib/exporters', () => ({
  downloadFile: vi.fn(),
}));

describe('Compliance', () => {
  it('renders "Compliance" heading after data loads', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('Compliance')).toBeInTheDocument());
  });

  it('renders description about automated mapping', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText(/Automated mapping of your findings/i)).toBeInTheDocument());
  });

  it('renders "SOC 2 Trust Services Criteria" section', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('SOC 2 Trust Services Criteria')).toBeInTheDocument());
  });

  it('renders "NIST Cybersecurity Framework (CSF)" section', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('NIST Cybersecurity Framework (CSF)')).toBeInTheDocument());
  });

  it('renders "CIS Controls v8" section', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('CIS Controls v8')).toBeInTheDocument());
  });

  it('renders "MITRE ATT&CK Tactics" section', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('MITRE ATT&CK Tactics')).toBeInTheDocument());
  });

  it('renders "SOC 2 Readiness" label', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('SOC 2 Readiness')).toBeInTheDocument());
  });

  it('renders stat cards: Open findings, Resolved, Total assessed', async () => {
    render(<Compliance />);
    await waitFor(() => {
      expect(screen.getByText('Open findings')).toBeInTheDocument();
      expect(screen.getByText('Resolved')).toBeInTheDocument();
      expect(screen.getByText('Total assessed')).toBeInTheDocument();
    });
  });

  it('renders "Export evidence" button', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('Export evidence')).toBeInTheDocument());
  });

  it('renders loading state initially', () => {
    render(<Compliance />);
    expect(screen.getByText(/Computing compliance posture/i)).toBeInTheDocument();
  });
});
