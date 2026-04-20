import fs from 'node:fs'
import path from 'node:path'

const cwd = process.cwd()
const targetDir = path.join(cwd, 'dist')
const candidateSourceDirs = [
  path.join(cwd, 'client', 'dist'),
  path.join(cwd, '..', 'dist'),
  path.join(cwd, '..', 'client', 'dist'),
  path.join(cwd, '..', '..', 'client', 'dist'),
]

const sourceDir = candidateSourceDirs.find((candidate) => fs.existsSync(candidate))

if (!sourceDir) {
  console.error('Vercel output preparation failed: source dist directory not found.')
  console.error(`Checked: ${candidateSourceDirs.join(', ')}`)
  process.exit(1)
}

if (path.resolve(sourceDir) !== path.resolve(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true })
  fs.cpSync(sourceDir, targetDir, { recursive: true })
}

console.log(`Prepared Vercel output directory: ${targetDir} (from ${sourceDir})`)
