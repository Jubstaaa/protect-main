import { describe, expect, test } from 'vitest'

import type { Options } from '../src/protect.js'

import { discoverChecks, protect, run } from '../src/protect.js'
import { actionsRun, fakeApi } from './fake-api.js'

const options: Options = {
    apply: true,
    name: 'protect-main',
    repos: [],
    requirePullRequest: true,
    samplePulls: 3,
}

describe('discoverChecks', () => {
    test('samples at most the requested number of merged pull requests', async () => {
        const { api } = fakeApi({
            checkRuns: {
                'app@one': [actionsRun('check'), actionsRun('image')],
                'app@three': [actionsRun('check'), actionsRun('image')],
                'app@two': [actionsRun('check')],
            },
            heads: { app: ['one', 'two', 'three'] },
        })
        expect(await discoverChecks(api, 'app', 2)).toEqual(['check'])
    })

    test('a pull request with no runs is not counted as a sample', async () => {
        const { api } = fakeApi({
            checkRuns: {
                'app@two': [actionsRun('check')],
            },
            heads: { app: ['one', 'two'] },
        })
        expect(await discoverChecks(api, 'app', 3)).toEqual(['check'])
    })

    test('a repository with no merged pull requests requires nothing', async () => {
        const { api } = fakeApi({ heads: {} })
        expect(await discoverChecks(api, 'app', 3)).toEqual([])
    })
})

describe('protect', () => {
    test('creates a ruleset where there is none', async () => {
        const { api, written } = fakeApi({
            checkRuns: { 'app@one': [actionsRun('check')] },
            heads: { app: ['one'] },
        })
        const result = await protect(api, 'app', false, options)
        expect(result).toEqual({
            action: 'create',
            checks: ['check'],
            private: false,
            repo: 'app',
        })
        expect(written[0]?.id).toBeUndefined()
    })

    test('updates the ruleset it already created', async () => {
        const { api, written } = fakeApi({
            checkRuns: { 'app@one': [actionsRun('check')] },
            heads: { app: ['one'] },
            rulesets: { app: [{ id: 7, name: 'protect-main' }] },
        })
        const result = await protect(api, 'app', false, options)
        expect(result.action).toBe('update')
        expect(written[0]?.id).toBe(7)
    })

    test('keeps what a ruleset requires when nothing is discovered', async () => {
        const { api, written } = fakeApi({
            heads: {},
            rulesets: {
                app: [
                    {
                        id: 7,
                        name: 'protect-main',
                        rules: [
                            {
                                parameters: {
                                    required_status_checks: [
                                        { context: 'build' },
                                    ],
                                },
                                type: 'required_status_checks',
                            },
                        ],
                    },
                ],
            },
        })
        const result = await protect(api, 'app', false, options)
        expect(result.checks).toEqual(['build'])
        expect(written).toHaveLength(1)
    })

    test('a dry run writes nothing', async () => {
        const { api, written } = fakeApi({
            checkRuns: { 'app@one': [actionsRun('check')] },
            heads: { app: ['one'] },
        })
        const result = await protect(api, 'app', false, {
            ...options,
            apply: false,
        })
        expect(result.checks).toEqual(['check'])
        expect(written).toHaveLength(0)
    })
})

describe('run', () => {
    test('walks every repository the account owns when none are named', async () => {
        const { api } = fakeApi({ repos: ['one', 'two'] })
        const results = await run(api, options)
        expect(results.map(result => result.repo)).toEqual(['one', 'two'])
    })

    test('one repository failing does not stop the rest', async () => {
        const { api } = fakeApi({
            failOn: ['two'],
            repos: ['one', 'two', 'three'],
        })
        const results = await run(api, options)
        expect(results.map(result => result.error ?? 'ok')).toEqual([
            'ok',
            'no administration access',
            'ok',
        ])
    })
})
