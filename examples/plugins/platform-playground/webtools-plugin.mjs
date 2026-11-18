import { runCli } from '../../../declarative-v1/src/cli.mjs'

process.exitCode = await runCli(process.argv.slice(2))
