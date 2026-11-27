import { appendFileSync } from 'node:fs'

import { format, run } from './protect.mjs'

function bool(name, fallback) {
    const value = input(name, String(fallback)).trim().toLowerCase()

    return value === 'true' || value === '1' || value === 'yes'
}

function input(name, fallback = '') {
    const value = process.env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`]

    return value === undefined || value === '' ? fallback : value
}

const token = input('token')
if (!token) {
    console.error('::error::token is required')
    process.exit(1)
}

const options = {
    apply: bool('apply', false),
    name: input('ruleset-name', 'protect-main'),
    owner: input('owner', process.env.GITHUB_REPOSITORY_OWNER ?? ''),
    repos: input('repos')
        .split(/[\s,]+/)
        .filter(Boolean),
    requirePullRequest: bool('require-pull-request', true),
    samplePulls: Number(input('sample-pulls', '3')),
    token,
}

if (!options.owner) {
    console.error('::error::owner is required outside a GitHub Actions run')
    process.exit(1)
}

const results = await run(options)
const lines = results.map(result => format(result, options.apply))
for (const line of lines) console.log(line)

const summary = process.env.GITHUB_STEP_SUMMARY
if (summary) {
    const heading = options.apply
        ? 'Branch protection'
        : 'Branch protection (dry run)'
    appendFileSync(
        summary,
        `## ${heading}\n\n${lines.map(line => `- ${line}`).join('\n')}\n`
    )
}

const failed = results.filter(result => result.error)
if (failed.length > 0) {
    console.error(`::error::${failed.length} repository/repositories failed`)
    process.exit(1)
}
