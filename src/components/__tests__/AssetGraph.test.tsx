import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import AssetGraph from '../AssetGraph';
import type { Vulnerability } from '../../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────

let _seq = 0;
function makeVuln(asset: string, severity: Vulnerability['severity'] = 'high'): Vulnerability {
  _seq++;
  return {
    id: `v-${_seq}`,
    scan_id: 'scan-1',
    user_id: 'user-1',
    title: `Finding ${_seq}`,
    description: 'desc',
    severity,
    cve_id: '',
    mitre_tactic: '',
    cis_control: '',
    asset,
    remediation: 'fix',
    remediation_code: '',
    remediation_type: 'manual',
    created_at: '2026-01-01T00:00:00Z',
    status: 'open',
    note: '',
    status_updated_at: '2026-01-01T00:00:00Z',
    sla_breached_at: null,
    sla_warned_at: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('AssetGraph — empty state', () => {
  it('shows empty state message when no vulns', () => {
    render(<AssetGraph projectName="TestProject" vulns={[]} />);
    expect(
      screen.getByText(/No assets mapped\. Run a scan to discover topology\./i),
    ).toBeInTheDocument();
  });

  it('does not render the topology SVG when no vulns', () => {
    const { container } = render(<AssetGraph projectName="TestProject" vulns={[]} />);
    // The topology SVG has a viewBox="0 0 600 500" attribute
    expect(container.querySelector('svg[viewBox="0 0 600 500"]')).not.toBeInTheDocument();
  });
});

describe('AssetGraph — with vulns', () => {
  it('renders SVG when vulns are provided', () => {
    const { container } = render(
      <AssetGraph projectName="TestProject" vulns={[makeVuln('api.example.com')]} />,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders project tooltip text for the center node', () => {
    render(
      <AssetGraph projectName="my.project.env" vulns={[makeVuln('api.example.com')]} />,
    );

    expect(screen.getByText('Project: my.project.env')).toBeInTheDocument();
  });

  it('shows "Asset Topology" heading', () => {
    render(
      <AssetGraph projectName="TestProject" vulns={[makeVuln('api.example.com')]} />,
    );
    expect(screen.getByText('Asset Topology')).toBeInTheDocument();
  });

  it('renders project name node (uppercase first segment)', () => {
    render(
      <AssetGraph projectName="my-project" vulns={[makeVuln('api.example.com')]} />,
    );
    // Project node label is projectName.split('.')[0].toUpperCase()
    expect(screen.getByText('MY-PROJECT')).toBeInTheDocument();
  });

  it('renders asset node label (uppercase first segment)', () => {
    render(
      <AssetGraph projectName="TestProject" vulns={[makeVuln('api.example.com')]} />,
    );
    // asset.split('.')[0].toUpperCase() → 'API'
    expect(screen.getByText('API')).toBeInTheDocument();
  });

  it('deduplicates assets — same asset with multiple vulns = one node', () => {
    const vulns = [
      makeVuln('db.example.com', 'high'),
      makeVuln('db.example.com', 'critical'),
    ];
    render(<AssetGraph projectName="TestProject" vulns={vulns} />);
    // Only one 'DB' node text label
    expect(screen.getAllByText('DB').length).toBe(1);
  });

  it('renders legend pills (Secure, Risk, Critical)', () => {
    render(
      <AssetGraph projectName="TestProject" vulns={[makeVuln('api.example.com')]} />,
    );
    expect(screen.getByText('Secure')).toBeInTheDocument();
    expect(screen.getByText('Risk')).toBeInTheDocument();
    // 'Critical' appears in both the stat pill label and the legend pill; use getAllByText
    expect(screen.getAllByText('Critical').length).toBeGreaterThan(0);
  });

  it('renders connecting lines for each asset node', () => {
    const { container } = render(
      <AssetGraph
        projectName="TestProject"
        vulns={[makeVuln('api.example.com'), makeVuln('db.example.com')]}
      />,
    );
    const lines = container.querySelectorAll('line');
    // One line per asset node (2)
    expect(lines.length).toBe(2);
  });

  it('aggregates stat cards by highest severity per unique asset', () => {
    const vulns = [
      makeVuln('db.example.com', 'low'),
      makeVuln('db.example.com', 'critical'),
      makeVuln('api.example.com', 'high'),
      makeVuln('cache.example.com', 'info'),
    ];

    render(<AssetGraph projectName="TestProject" vulns={vulns} />);

    const assetsCard = screen.getByText('Assets').previousElementSibling;
    const criticalCard = screen.getAllByText('Critical')[0].previousElementSibling;
    const highRiskCard = screen.getByText('High risk').previousElementSibling;
    const safeCard = screen.getByText('Low/Safe').previousElementSibling;

    expect(assetsCard).toHaveTextContent('3');
    expect(criticalCard).toHaveTextContent('1');
    expect(highRiskCard).toHaveTextContent('1');
    expect(safeCard).toHaveTextContent('1');
  });

  it('renders expected asset icons for common label patterns and fallback', () => {
    const { container } = render(
      <AssetGraph
        projectName="TestProject"
        vulns={[
          makeVuln('db-main.internal', 'high'),
          makeVuln('s3-bucket.internal', 'medium'),
          makeVuln('ec2-node.internal', 'low'),
          makeVuln('api-gw.internal', 'critical'),
          makeVuln('mystery-host.internal', 'info'),
        ]}
      />,
    );

    expect(container.querySelector('.lucide-database')).toBeInTheDocument();
    expect(container.querySelectorAll('.lucide-box').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('.lucide-server')).toBeInTheDocument();
    expect(container.querySelectorAll('.lucide-globe').length).toBeGreaterThanOrEqual(1);
  });

  it('does not include medium assets in Critical/High/Low-Safe counters', () => {
    render(
      <AssetGraph
        projectName="TestProject"
        vulns={[makeVuln('mid-risk.example.com', 'medium')]}
      />,
    );

    const assetsCard = screen.getByText('Assets').previousElementSibling;
    const criticalCard = screen.getAllByText('Critical')[0].previousElementSibling;
    const highRiskCard = screen.getByText('High risk').previousElementSibling;
    const safeCard = screen.getByText('Low/Safe').previousElementSibling;

    expect(assetsCard).toHaveTextContent('1');
    expect(criticalCard).toHaveTextContent('0');
    expect(highRiskCard).toHaveTextContent('0');
    expect(safeCard).toHaveTextContent('0');
  });

  it('renders critical glow circle for critical asset nodes', () => {
    const { container } = render(
      <AssetGraph
        projectName="TestProject"
        vulns={[makeVuln('critical-host.example.com', 'critical')]}
      />,
    );

    expect(container.querySelector('circle.animate-pulse[filter="url(#glow)"]')).toBeInTheDocument();
  });

  it('shows asset title tooltip with aggregated finding count', () => {
    render(
      <AssetGraph
        projectName="TestProject"
        vulns={[
          makeVuln('api.example.com', 'high'),
          makeVuln('api.example.com', 'low'),
        ]}
      />,
    );

    expect(screen.getByText('api.example.com · 2 finding(s) · high')).toBeInTheDocument();
  });

  it('renders cloud and file-code icon branches from asset labels', () => {
    const { container } = render(
      <AssetGraph
        projectName="TestProject"
        vulns={[
          makeVuln('cloud-infra.example.com', 'high'),
          makeVuln('git-repo.example.com', 'low'),
        ]}
      />,
    );

    expect(container.querySelector('.lucide-cloud')).toBeInTheDocument();
    expect(container.querySelector('.lucide-file-code')).toBeInTheDocument();
  });

  it('renders fallback box icon for unknown asset labels', () => {
    const { container } = render(
      <AssetGraph
        projectName="TestProject"
        vulns={[makeVuln('mystery-host.internal', 'info')]}
      />,
    );

    expect(container.querySelector('.lucide-box')).toBeInTheDocument();
  });

  it('uses first segment when rendering asset labels with dots', () => {
    render(
      <AssetGraph
        projectName="TestProject"
        vulns={[makeVuln('api.prod.example.com', 'high')]}
      />,
    );

    expect(screen.getByText('API')).toBeInTheDocument();
  });

  it('renders Database icon for redis-prefixed asset label', () => {
    const { container } = render(
      <AssetGraph
        projectName="TestProject"
        vulns={[makeVuln('redis-cache.internal', 'medium')]}
      />,
    );

    expect(container.querySelector('.lucide-database')).toBeInTheDocument();
  });

  it('renders Globe icon for lb-prefixed asset label', () => {
    const { container } = render(
      <AssetGraph
        projectName="TestProject"
        vulns={[makeVuln('lb-frontend.internal', 'low')]}
      />,
    );

    expect(container.querySelector('.lucide-globe')).toBeInTheDocument();
  });

  it('renders Box icon for storage-prefixed asset label', () => {
    const { container } = render(
      <AssetGraph
        projectName="TestProject"
        vulns={[makeVuln('storage-main.internal', 'high')]}
      />,
    );

    expect(container.querySelector('.lucide-box')).toBeInTheDocument();
  });
});
