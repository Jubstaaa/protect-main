import { parseArgs } from 'node:util'

import { createApi } from './api.js'
import { run } from './protect.js'
import { report } from './summary.js'

const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
        'all': { type: 'boolean' },
        'apply': { type: 'boolean' },
        'no-pull-request': { type: 'boolean' },
        'owner': { type: 'string' },
        'ruleset-name': { type: 'string' },
        'sample-pulls': { type: 'string' },
    },
})

const token = process.env.GITHUB_TOKEN ?? ''
if (!token) {
    console.error('set GITHUB_TOKEN to a token with administration: write')
    process.exit(1)
}

const owner = values.owner ?? process.env.GITHUB_REPOSITORY_OWNER ?? ''
if (!owner) {
    console.error('pass --owner, or set GITHUB_REPOSITORY_OWNER')
    process.exit(1)
}

if (positionals.length === 0 && values.all !== true) {
    console.error(
        'usage: protect-main [--apply] [--no-pull-request] --owner <account> (--all | <repo...>)'
    )
    process.exit(1)
}

const apply = values.apply === true
const results = await run(createApi(token, owner), {
    apply,
    name: values['ruleset-name'] ?? 'protect-main',
    repos: positionals,
    requirePullRequest: values['no-pull-request'] !== true,
    samplePulls: Number(values['sample-pulls'] ?? '3'),
})

for (const line of report(results, apply)) console.log(line)
if (results.some(result => result.error !== undefined)) process.exitCode = 1
