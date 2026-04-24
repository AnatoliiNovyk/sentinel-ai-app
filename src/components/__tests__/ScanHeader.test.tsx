import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { ScanHeader } from '../scans/ScanHeader';
import type { Project } from '../../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeProject(id: string, name: string): Project {
  return {
    id,
    user_id: 'user-1',
    org_id: 'org-1',
    name,
    description: 'desc',
    target: 'example.com',
    environment: 'external',
    created_at: '2026-01-01T00:00:00Z',
    tags: [],
    risk_score: 0,
  };
}

const PROJECTS = [makeProject('p1', 'Alpha'), makeProject('p2', 'Beta')];

const BASE_PROPS = {
  projects: PROJECTS,
  selectedProjectId: null,
  onSelectProject: vi.fn(),
  onNewScan: vi.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe('ScanHeader — static rendering', () => {
  it('renders the page heading', () => {
    render(<ScanHeader {...BASE_PROPS} />);
    expect(screen.getByText('Vulnerability Scans')).toBeInTheDocument();
  });

  it('renders "New Scan" button', () => {
    render(<ScanHeader {...BASE_PROPS} />);
    expect(screen.getByRole('button', { name: /new scan/i })).toBeInTheDocument();
  });

  it('renders project select with placeholder option', () => {
    render(<ScanHeader {...BASE_PROPS} />);
    expect(screen.getByRole('combobox', { name: /select project/i })).toBeInTheDocument();
    expect(screen.getByText('Select Project...')).toBeInTheDocument();
  });

  it('renders all project options', () => {
    render(<ScanHeader {...BASE_PROPS} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });
});

describe('ScanHeader — mode badge', () => {
  it('shows "Mode: REAL" badge in REAL mode', () => {
    render(<ScanHeader {...BASE_PROPS} currentMode="REAL" />);
    expect(screen.getByText('Mode: REAL')).toBeInTheDocument();
  });

  it('shows "⚠ DEMO MODE" badge in MOCK mode', () => {
    render(<ScanHeader {...BASE_PROPS} currentMode="MOCK" />);
    expect(screen.getByText('⚠ DEMO MODE')).toBeInTheDocument();
  });

  it('shows "Mode: UNKNOWN" badge when mode is UNKNOWN', () => {
    render(<ScanHeader {...BASE_PROPS} currentMode="UNKNOWN" />);
    expect(screen.getByText('Mode: UNKNOWN')).toBeInTheDocument();
  });

  it('defaults to UNKNOWN mode when currentMode not provided', () => {
    render(<ScanHeader {...BASE_PROPS} />);
    expect(screen.getByText('Mode: UNKNOWN')).toBeInTheDocument();
  });
});

describe('ScanHeader — interactions', () => {
  it('calls onNewScan when "New Scan" button clicked', () => {
    const onNewScan = vi.fn();
    render(<ScanHeader {...BASE_PROPS} onNewScan={onNewScan} />);
    fireEvent.click(screen.getByRole('button', { name: /new scan/i }));
    expect(onNewScan).toHaveBeenCalledOnce();
  });

  it('calls onSelectProject with project id when select changes', () => {
    const onSelectProject = vi.fn();
    render(<ScanHeader {...BASE_PROPS} onSelectProject={onSelectProject} />);
    fireEvent.change(screen.getByRole('combobox', { name: /select project/i }), {
      target: { value: 'p2' },
    });
    expect(onSelectProject).toHaveBeenCalledWith('p2');
  });

  it('shows selected project in select when selectedProjectId is set', () => {
    render(<ScanHeader {...BASE_PROPS} selectedProjectId="p1" />);
    const select = screen.getByRole('combobox', { name: /select project/i }) as HTMLSelectElement;
    expect(select.value).toBe('p1');
  });
});
