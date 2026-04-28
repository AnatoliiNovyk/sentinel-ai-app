#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function parseArgs(argv) {
  const args = { reportFile: '' };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--report-file' && i + 1 < argv.length) {
      args.reportFile = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function getPayloadForReport(report) {
  if (!report || typeof report !== 'object') {
    throw new Error('Report must be a JSON object');
  }

  if (report.schema_version !== '1.0') {
    throw new Error(`Unsupported schema_version: ${report.schema_version}`);
  }

  if (!report.report_type || typeof report.report_type !== 'string') {
    throw new Error('Missing or invalid report_type');
  }

  if (report.report_type === 'daily_scan_health_report') {
    return {
      summary: report.summary,
      thresholds_ok: report.thresholds_ok,
      threshold_breaches: report.threshold_breaches,
    };
  }

  if (report.report_type === 'scan_pipeline_recovery_playbook') {
    return {
      summary: report.summary,
    };
  }

  if (report.report_type === 'chaos_ops_drill') {
    const clone = { ...report };
    delete clone.evidence_id;
    delete clone.integrity;
    return clone;
  }

  if (report.report_type === 'weekly_slo_sla_summary') {
    return {
      summary: report.summary,
      thresholds_ok: report.thresholds_ok,
      threshold_breaches: report.threshold_breaches,
    };
  }

  throw new Error(`Unsupported report_type: ${report.report_type}`);
}

function getEvidencePrefix(reportType) {
  if (reportType === 'daily_scan_health_report') {
    return 'daily-health';
  }

  if (reportType === 'scan_pipeline_recovery_playbook') {
    return 'recovery-playbook';
  }

  if (reportType === 'chaos_ops_drill') {
    return 'chaos-drill';
  }

  if (reportType === 'weekly_slo_sla_summary') {
    return 'weekly-slo-sla';
  }

  throw new Error(`Unsupported report_type for evidence_id validation: ${reportType}`);
}

function validateEvidenceId(report, payloadHash) {
  if (!report.evidence_id || typeof report.evidence_id !== 'string') {
    throw new Error('Missing or invalid evidence_id');
  }

  const expectedPrefix = getEvidencePrefix(report.report_type);
  const pattern = new RegExp(`^${expectedPrefix}-\\d{8}T\\d{6}Z-[a-f0-9]{12}$`);
  if (!pattern.test(report.evidence_id)) {
    throw new Error(`Invalid evidence_id format for ${report.report_type}: ${report.evidence_id}`);
  }

  const expectedHashPart = payloadHash.slice(0, 12);
  const actualHashPart = report.evidence_id.slice(-12);
  if (actualHashPart !== expectedHashPart) {
    throw new Error(`evidence_id hash suffix mismatch: expected=${expectedHashPart} actual=${actualHashPart}`);
  }
}

function main() {
  const { reportFile } = parseArgs(process.argv.slice(2));
  if (!reportFile) {
    throw new Error('Missing --report-file argument');
  }

  const resolved = path.resolve(reportFile);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Report file not found: ${resolved}`);
  }

  const text = fs.readFileSync(resolved, 'utf8');
  const report = JSON.parse(text);

  if (!report.integrity || report.integrity.algorithm !== 'sha256' || !report.integrity.payload_hash) {
    throw new Error('Missing or invalid integrity metadata (sha256 payload_hash required)');
  }

  const payload = getPayloadForReport(report);
  const actualHash = sha256Hex(JSON.stringify(payload));

  if (actualHash !== report.integrity.payload_hash) {
    throw new Error(`Integrity mismatch: expected=${report.integrity.payload_hash} actual=${actualHash}`);
  }

  validateEvidenceId(report, actualHash);

  process.stdout.write(`Evidence integrity verified: ${report.report_type} (${report.evidence_id || 'n/a'})\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || String(error)}\n`);
  process.exit(1);
}
