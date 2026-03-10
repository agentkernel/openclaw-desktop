/**
 * 端口检测 — TCP 端口占用检测，返回占用进程信息
 */

import net from 'net'
import { execSync } from 'child_process'

/** 端口检测结果 */
export interface PortCheckResult {
  available: boolean
  pid?: number
  processName?: string
}

/**
 * 检测 TCP 端口是否可用
 * @param port 端口号
 * @returns 可用时 available=true；占用时 available=false，pid 为占用进程 ID（Windows 可解析）
 */
export function checkPort(port: number): Promise<PortCheckResult> {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(getPortOccupantInfo(port))
      } else {
        resolve({ available: false })
      }
    })

    server.once('listening', () => {
      server.close(() => {
        resolve({ available: true })
      })
    })

    server.listen(port, '127.0.0.1')
  })
}

/**
 * 获取占用端口的进程信息（Windows）
 */
function getPortOccupantInfo(port: number): PortCheckResult {
  if (process.platform !== 'win32') {
    return { available: false }
  }

  try {
    const output = execSync(`netstat -ano | findstr :${port}`, {
      encoding: 'utf-8',
      windowsHide: true,
    })

    const lines = output.trim().split('\n')
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      const pidPart = parts[parts.length - 1]
      if (pidPart && pidPart !== '0' && /^\d+$/.test(pidPart)) {
        const pid = parseInt(pidPart, 10)
        return {
          available: false,
          pid,
        }
      }
    }
  } catch {
    // netstat 失败时仅返回占用状态
  }

  return { available: false }
}
