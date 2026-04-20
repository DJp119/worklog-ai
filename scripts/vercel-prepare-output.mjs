import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const sourceDir = path.join(rootDir, 'client', 'dist')
const targetDir = path.join(rootDir, 'dist')

if (!fs.existsSync(sourceDir)) {
  console.error(`Vercel output preparation failed: source not found at ${sourceDir}`)
  process.exit(1)
}

fs.rmSync(targetDir, { recursive: true, force: true })
fs.cpSync(sourceDir, targetDir, { recursive: true })

console.log(`Prepared Vercel output directory: ${targetDir}`)
