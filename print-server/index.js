/**
 * Local print server for DNP 2×6 strips (macOS CUPS / `lp`).
 * Run on the laptop connected to the DNP printer.
 *
 * Env:
 *   PORT=3847
 *   PRINTER_NAME=DNP_DS620   (exact name from `lpstat -p`)
 *   PRINT_MEDIA=w288h432     (optional CUPS media option for 2×6)
 */

import cors from 'cors'
import express from 'express'
import fs from 'fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import multer from 'multer'
import os from 'os'
import path from 'path'

const execFileAsync = promisify(execFile)
const PORT = Number(process.env.PORT ?? 3847)
const PRINTER = process.env.PRINTER_NAME ?? ''
const PRINT_MEDIA = process.env.PRINT_MEDIA ?? ''

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })
const app = express()

app.use(cors({ origin: true }))
app.use(express.json())

app.get('/health', async (_req, res) => {
  try {
    if (!PRINTER) {
      return res.json({ ok: true, printer: null, note: 'Set PRINTER_NAME to auto-print' })
    }
    const { stdout } = await execFileAsync('lpstat', ['-p', PRINTER])
    res.json({ ok: stdout.includes(PRINTER), printer: PRINTER, lpstat: stdout.trim() })
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message })
  }
})

app.post('/print', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('Missing image file')
  }

  const captureId = req.body?.captureId ?? 'strip'
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'photobooth-'))
  const filePath = path.join(tmpDir, `${captureId}.png`)

  try {
    await fs.writeFile(filePath, req.file.buffer)

    if (!PRINTER) {
      return res.status(400).send(
        'PRINTER_NAME is not set. Export PRINTER_NAME=$(lpstat -p | head -1 | awk "{print $2}")',
      )
    }

    const args = ['-d', PRINTER, '-o', 'fit-to-page']
    if (PRINT_MEDIA) {
      args.push('-o', `media=${PRINT_MEDIA}`)
    }
    args.push(filePath)

    const { stdout, stderr } = await execFileAsync('lp', args)
    res.json({ ok: true, job: stdout.trim() || stderr.trim() })
  } catch (e) {
    res.status(500).send(e.message ?? 'Print failed')
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
})

app.listen(PORT, () => {
  console.log(`Print server http://localhost:${PORT}`)
  console.log(`Printer: ${PRINTER || '(not set — health OK, print needs PRINTER_NAME)'}`)
})
