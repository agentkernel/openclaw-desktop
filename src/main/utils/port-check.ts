/** TCP port availability + optional owning PID (Windows) */

import net from 'net'
import { execSync } from 'child_process'

/** Port probe result */
export interface PortCheckResult {
  available: boolean
  pid?: number
  processName?: string
}

/**
 * @returns available=true if free; else false with pid when known (Windows)
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
 * Resolve listening PID on Windows
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
    // If netstat fails, still report "in use" when connect fails
  }

  return { available: false }
}
