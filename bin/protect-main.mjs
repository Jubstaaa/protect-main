#!/usr/bin/env node
import { parseArgs } from 'node:util'

import { format, run } from '../src/protect.mjs'

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

if (positionals.length === 0 && values.all !== true) {
    console.error(
        'usage: protect-main [--apply] [--no-pull-request] (--all | <repo...>)'
    )
    process.exit(1)
}

const options = {
    apply: values.apply === true,
    name: values['ruleset-name'] ?? 'protect-main',
    owner: values.owner ?? 'Jubstaaa',
    repos: positionals,
    requirePullRequest: values['no-pull-request'] !== true,
    samplePulls: Number(values['sample-pulls'] ?? '3'),
    token,
}

const results = await run(options)
for (const result of results) console.log(format(result, options.apply))
if (results.some(result => result.error)) process.exitCode = 1
