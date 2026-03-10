#!/usr/bin/env node
/**
 * 开发启动脚本：Windows 下自动设置控制台为 UTF-8，彻底解决 Gateway 日志乱码。
 * 在启动 electron-vite 前执行 chcp 65001，无需用户每次手动执行。
 */
import { spawnSync, spawn } from 'node:child_process'
import { platform } from 'node:os'

const isWin = platform() === 'win32'
if (isWin) {
  // chcp 65001 将控制台设为 UTF-8；>nul 隐藏 "Active code page" 输出
  spawnSync('cmd', ['/c', 'chcp 65001 >nul'], { stdio: 'inherit' })
}

const proc = spawn('npx', ['electron-vite', 'dev'], {
  stdio: 'inherit',
  shell: isWin,
})
proc.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0))
})
