#!/usr/bin/env node
/**
 * Dev entry: on Windows, set console to UTF-8 (chcp 65001) before electron-vite for readable gateway logs.
 */
import { spawnSync, spawn } from 'node:child_process'
import { platform } from 'node:os'

const isWin = platform() === 'win32'
if (isWin) {
  // UTF-8 code page; >nul hides "Active code page" banner
  spawnSync('cmd', ['/c', 'chcp 65001 >nul'], { stdio: 'inherit' })
}

const proc = spawn('npx', ['electron-vite', 'dev'], {
  stdio: 'inherit',
  shell: isWin,
})
proc.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0))
})
