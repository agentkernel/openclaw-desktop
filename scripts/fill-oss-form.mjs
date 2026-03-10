#!/usr/bin/env node
/**
 * 根据项目实际情况填写 OSS Request Form
 * 运行: node scripts/fill-oss-form.mjs
 *
 * 需手动填写的占位符：
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

// 从环境变量或参数读取用户信息，否则用占位符
const USER_FULL_NAME = process.env.OSS_USER_FULL_NAME || '[请填写您的真实姓名]';
const USER_EMAIL = process.env.OSS_USER_EMAIL || '[请填写您的邮箱]';

const FORM_VALUES = {
  D2: 'OpenClaw Desktop',           // Name - 文档和安装器对外名称
  D4: 'openclaw-desktop',           // Handle - 与 artifact-configuration-slug 一致
  D6: 'Program',                    // Type - 桌面安装器应用
  D8: 'MIT License - https://opensource.org/licenses/MIT',
  D10: 'https://github.com/agentkernel/openclaw-desktop',
  D12: 'https://github.com/agentkernel/openclaw-desktop',
  D14: 'https://github.com/agentkernel/openclaw-desktop/releases',
  D16: '',                          // Privacy Policy URL - 安装器不收集用户数据可留空
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
console.log('已生成:', outputPath);
if (USER_FULL_NAME.startsWith('[') || USER_EMAIL.startsWith('[')) {
  console.log('\n请手动编辑填写: User Full Name (D26), User Email (D28)');
  console.log('或设置环境变量: OSS_USER_FULL_NAME, OSS_USER_EMAIL');
}
