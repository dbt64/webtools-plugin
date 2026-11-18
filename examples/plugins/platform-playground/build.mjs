import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(projectRoot, '../../..')
const outputRoot = resolve(projectRoot, 'dist')

const files = [
  ['manifest.json', 'manifest.json'],
  ['agent-note.cjs', 'agent-note.cjs'],
  ['preload.cjs', 'preload.cjs'],
  ['web/index.html', 'web/index.html'],
  ['web/styles.css', 'web/styles.css'],
  ['web/app.mjs', 'web/app.mjs'],
  ['web/workflow.mjs', 'web/workflow.mjs'],
  ['web/child.html', 'web/child.html'],
  ['web/child.mjs', 'web/child.mjs'],
  ['declarative-v1/web/index.mjs', 'web/sdk/index.mjs'],
  ['declarative-v1/web/bridge-client.mjs', 'web/sdk/bridge-client.mjs'],
  ['declarative-v1/web/capability-methods.mjs', 'web/sdk/capability-methods.mjs'],
  ['declarative-v1/web/protocol.mjs', 'web/sdk/protocol.mjs'],
  ['declarative-v1/web/invocation-context.mjs', 'web/sdk/invocation-context.mjs'],
  ['declarative-v1/runtime-v3/selected-text-match.mjs', 'web/runtime-v3/selected-text-match.mjs'],
  ['declarative-v1/web/theme.css', 'web/sdk/theme.css'],
  ['declarative-v1/web/ui.css', 'web/sdk/ui.css'],
]

await mkdir(outputRoot, { recursive: true })
for (const [source, destination] of files) {
  const target = resolve(outputRoot, destination)
  await mkdir(dirname(target), { recursive: true })
  await copyFile(resolve(source.startsWith('declarative-v1/') ? repositoryRoot : projectRoot, source), target)
}

console.log(`Built platform-playground runtime in ${outputRoot}`)
