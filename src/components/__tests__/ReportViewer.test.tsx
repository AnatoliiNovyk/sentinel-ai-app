import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReportViewer from '../ReportViewer';
import type { Report } from '../../lib/supabase';

// ── Mocks ─────────────────────────────────────────────────────────────────

const { mockEq, mockUpdate } = vi.hoisted(() => ({
  mockEq: vi.fn().mockResolvedValue({ data: null, error: null }),
  mockUpdate: vi.fn(),
}));

mockUpdate.mockReturnValue({ eq: mockEq });

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ update: mockUpdate }),
  },
}));

const { mockDownloadFile } = vi.hoisted(() => ({
  mockDownloadFile: vi.fn(),
}));

vi.mock('../../lib/exporters', () => ({
  downloadFile: mockDownloadFile,
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 'report-1',
    project_id: 'proj-1',
    user_id: 'user-1',
    title: 'Security Report Q1',
    kind: 'executive',
    content: '# Findings\n\nAll good.',
    created_at: '2026-04-24T10:00:00Z',
    share_token: null,
    is_public: false,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('ReportViewer', () => {
  let clipboardMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clipboardMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: clipboardMock } });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      'aaaabbbb-0000-1111-2222-ccccddddeeee',
    );
    mockEq.mockClear();
    mockUpdate.mockClear();
    mockDownloadFile.mockClear();
  });

  describe('rendering', () => {
    it('displays the report title', () => {
      render(<ReportViewer report={makeReport()} onClose={vi.fn()} />);
      expect(screen.getByText('Security Report Q1')).toBeInTheDocument();
    });

    it('shows "Executive Summary" kind badge for executive report', () => {
      render(<ReportViewer report={makeReport({ kind: 'executive' })} onClose={vi.fn()} />);
      expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    });

    it('shows "Technical Deep Dive" kind badge for technical report', () => {
      render(<ReportViewer report={makeReport({ kind: 'technical' })} onClose={vi.fn()} />);
      expect(screen.getByText('Technical Deep Dive')).toBeInTheDocument();
    });

    it('renders Preview and Markdown toggle buttons', () => {
      render(<ReportViewer report={makeReport()} onClose={vi.fn()} />);
      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.getByText('Markdown')).toBeInTheDocument();
    });

    it('shows Copy, Download and Share buttons', () => {
      render(<ReportViewer report={makeReport()} onClose={vi.fn()} />);
      expect(screen.getByTitle('Copy Markdown')).toBeInTheDocument();
      expect(screen.getByTitle('Download .md')).toBeInTheDocument();
      // Share button exists (title changes based on state)
      expect(screen.getByTitle('Generate public link')).toBeInTheDocument();
    });
  });

  describe('close interactions', () => {
    it('calls onClose when X button clicked', () => {
      const onClose = vi.fn();
      render(<ReportViewer report={makeReport()} onClose={onClose} />);
      // Find the X button by its position in the DOM (last button in header)
      const allButtons = screen.getAllByRole('button');
      // X button is the last one in the header row
      fireEvent.click(allButtons[allButtons.length - 1]);
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when Escape key pressed', () => {
      const onClose = vi.fn();
      render(<ReportViewer report={makeReport()} onClose={onClose} />);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe('copy action', () => {
    it('calls clipboard.writeText with report content when Copy clicked', async () => {
      const report = makeReport();
      render(<ReportViewer report={report} onClose={vi.fn()} />);
      fireEvent.click(screen.getByTitle('Copy Markdown'));
      expect(clipboardMock).toHaveBeenCalledWith(report.content);
    });

    it('shows "Copied!" feedback after copying', async () => {
      render(<ReportViewer report={makeReport()} onClose={vi.fn()} />);
      fireEvent.click(screen.getByTitle('Copy Markdown'));
      expect(await screen.findByText('Copied!')).toBeInTheDocument();
    });
  });

  describe('download action', () => {
    it('calls downloadFile with slugified title and markdown mime', () => {
      render(<ReportViewer report={makeReport()} onClose={vi.fn()} />);
      fireEvent.click(screen.getByTitle('Download .md'));
      expect(mockDownloadFile).toHaveBeenCalledWith(
        'security-report-q1.md',
        '# Findings\n\nAll good.',
        'text/markdown',
      );
    });
  });

  describe('share action', () => {
    it('calls supabase update with new token when no shareToken exists', async () => {
      render(<ReportViewer report={makeReport({ share_token: null })} onClose={vi.fn()} />);
      fireEvent.click(screen.getByTitle('Generate public link'));
      // Wait for async update
      await screen.findByText('Link copied!');
      expect(mockUpdate).toHaveBeenCalledWith({
        is_public: true,
        share_token: 'aaaabbbb-0000-1111-2222-ccccddddeeee',
      });
    });

    it('copies existing share link without calling supabase when shareToken already set', async () => {
      render(
        <ReportViewer
          report={makeReport({ share_token: 'existing-token-abc' })}
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByTitle('Copy share link'));
      expect(clipboardMock).toHaveBeenCalledWith(expect.stringContaining('existing-token-abc'));
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});
