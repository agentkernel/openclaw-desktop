#!/usr/bin/env node
/**
 * Fill OSS Request Form template from project defaults.
 * Run: node scripts/fill-oss-form.mjs
 *
 * Still edit manually:
 *   - User Full Name (D26)
 *   - User Email (D28)
 */
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const templatePath = join(root, 'OSSRequestForm-v4.xlsx');
const outputPath = join(root, 'OSSRequestForm-v4-filled.xlsx');

const USER_FULL_NAME = process.env.OSS_USER_FULL_NAME || '[Your full name]';
const USER_EMAIL = process.env.OSS_USER_EMAIL || '[Your email]';

const FORM_VALUES = {
  D2: 'OpenClaw Desktop',           // Public product name
  D4: 'openclaw-desktop',           // Handle / artifact slug
  D6: 'Program',                    // Desktop installer
  D8: 'GPL-3.0 License - https://www.gnu.org/licenses/gpl-3.0',
  D10: 'https://github.com/agentkernel/openclaw-desktop',
  D12: 'https://github.com/agentkernel/openclaw-desktop',
  D14: 'https://github.com/agentkernel/openclaw-desktop/releases',
  D16: '',                          // Privacy policy URL (optional if no collection)
  D18: '',                          // Wikipedia URL
  D20: 'All-in-one installer for OpenClaw Windows Desktop',
  D22: 'Electron-based Windows installer that bundles OpenClaw and Node.js, providing a native desktop experience with an installation wizard and visual configuration.',
  D24: 'Open source project on GitHub (github.com/agentkernel/openclaw-desktop) with CI/CD via GitHub Actions. Community-maintained Windows distribution for OpenClaw.',
  D26: USER_FULL_NAME,
  D28: USER_EMAIL,
  D30: 'GitHub Actions',
  D32: 'I hereby accept the terms of use',
};

const wb = XLSX.readFile(templatePath);
const formSheet = wb.Sheets['Form'];

for (const [cell, value] of Object.entries(FORM_VALUES)) {
  if (value) {
    formSheet[cell] = { t: 's', v: value };
  }
}

XLSX.writeFile(wb, outputPath);
console.log('Written:', outputPath);
if (USER_FULL_NAME.startsWith('[') || USER_EMAIL.startsWith('[')) {
  console.log('\nEdit User Full Name (D26) and User Email (D28), or set OSS_USER_FULL_NAME / OSS_USER_EMAIL.');
}
