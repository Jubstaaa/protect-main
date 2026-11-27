import * as core from '@actions/core'

import type { Options } from './protect.js'

export interface Inputs extends Options {
    owner: string
    token: string
}

export function readInputs(): Inputs {
    const token = core.getInput('token', { required: true })
    const owner =
        core.getInput('owner') || (process.env.GITHUB_REPOSITORY_OWNER ?? '')
    if (!owner) {
        throw new Error(
            'owner is required when the action runs outside a repository'
        )
    }
    const samplePulls = Number(core.getInput('sample-pulls') || '3')
    if (!Number.isInteger(samplePulls) || samplePulls < 1) {
        throw new Error(
            `sample-pulls must be a positive whole number, got "${core.getInput('sample-pulls')}"`
        )
    }

    return {
        apply: core.getBooleanInput('apply'),
        name: core.getInput('ruleset-name') || 'protect-main',
        owner,
        repos: core
            .getInput('repos')
            .split(/[\s,]+/)
            .filter(Boolean),
        requirePullRequest: core.getBooleanInput('require-pull-request'),
        samplePulls,
        token,
    }
}
