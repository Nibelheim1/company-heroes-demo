import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
await fs.mkdir(path.join(root, 'public', 'data'), { recursive: true })
await fs.copyFile(path.join(root, 'data', 'heroes.json'), path.join(root, 'public', 'data', 'heroes.json'))
await fs.copyFile(path.join(root, 'data', 'asset-report.json'), path.join(root, 'public', 'data', 'asset-report.json'))
console.log('copied heroes.json and asset-report.json to public/data')
