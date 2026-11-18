import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createPluginProject } from '../src/create-project.mjs'

test('templates use the shipped SDK release and pure JS Node starters do not require a native ABI', async () => {
  const sdk = JSON.parse(await readFile(new URL('../../declarative-v1/package.json', import.meta.url)))
  const generator = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
  const root = await mkdtemp(join(tmpdir(), 'wt-p6-'))
  try {
    for (const framework of ['vanilla', 'vue', 'react', 'svelte']) for (const runtime of ['web', 'node']) {
      await createPluginProject(`${framework}-${runtime}`, { cwd: root, framework, runtime })
      const base = join(root, `${framework}-${runtime}`)
      const pkg = JSON.parse(await readFile(join(base, 'package.json')))
      assert.equal((runtime === 'node' ? pkg.dependencies : pkg.devDependencies)['@webtools/plugin-sdk'], sdk.version)
      const target = JSON.parse(await readFile(join(base, 'webtools-toolchain.json')))
      for (const script of ['validate', 'pack', 'inspect']) assert.ok(pkg.scripts[script].includes(`--host-version ${target.productVersion}`))
      assert.equal(pkg.engines.node, sdk.engines.node)
      const manifest = JSON.parse(await readFile(join(base, 'manifest.json')))
      assert.equal(manifest.compatibility.nodeAbi, undefined)
      const guide = await readFile(join(base, 'README.md'), 'utf8')
      assert.ok(guide.includes(`webtools-plugin-sdk-${sdk.version}.tgz`))
    }
    assert.equal(generator.version, sdk.version)
  } finally { await rm(root, { recursive: true, force: true }) }
})
