import { readFile, writeFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'))
const write = (name, value) => writeFile(new URL(name, root), JSON.stringify(value, null, 2) + '\n')
const sdk = await read('declarative-v1/package.json')
const target = await read('declarative-v1/runtime-target.json')
const generatorPath = 'create-webtools-plugin/package.json'
const snapshotPath = 'create-webtools-plugin/src/toolchain.json'
const generator = await read(generatorPath)
const expected = { sdkVersion: sdk.version, developmentNode: sdk.engines.node, ...target }

if (process.argv.includes('--check')) {
  if (generator.version !== sdk.version || generator.engines.node !== sdk.engines.node
    || JSON.stringify(await read(snapshotPath)) !== JSON.stringify(expected)) {
    throw Error('Plugin toolchain drift; run pnpm run toolchain:sync')
  }
  console.log('Plugin toolchain ' + sdk.version + ' is consistent')
} else {
  generator.version = sdk.version
  generator.engines.node = sdk.engines.node
  await write(generatorPath, generator)
  await write(snapshotPath, expected)
}
