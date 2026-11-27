import { describe, expect, test } from 'vitest'

import {
    buildRuleset,
    existingChecks,
    intersect,
    reportedChecks,
} from '../src/rules.js'

describe('intersect', () => {
    test('a check must appear in every sampled pull request', () => {
        expect(
            intersect([
                new Set(['check', 'auto-merge']),
                new Set(['check']),
                new Set(['check', 'image']),
            ])
        ).toEqual(['check'])
    })

    test('no samples means no required checks', () => {
        expect(intersect([])).toEqual([])
    })

    test('a single sample is taken as it is, sorted', () => {
        expect(intersect([new Set(['b', 'a'])])).toEqual(['a', 'b'])
    })
})

describe('reportedChecks', () => {
    test('drops the jobs that were skipped', () => {
        expect([
            ...reportedChecks([
                { conclusion: 'success', name: 'check / gate' },
                { conclusion: 'skipped', name: 'auto-merge' },
                { conclusion: 'failure', name: 'image' },
            ]),
        ]).toEqual(['check / gate', 'image'])
    })
})

describe('buildRuleset', () => {
    test('deletion and non-fast-forward are always there', () => {
        const ruleset = buildRuleset({
            checks: [],
            name: 'protect-main',
            requirePullRequest: false,
        })
        expect(
            ruleset.rules.map(rule => (rule as { type: string }).type)
        ).toEqual(['deletion', 'non_fast_forward'])
        expect(ruleset.conditions.ref_name.include).toEqual(['~DEFAULT_BRANCH'])
    })

    test('a pull request is required without requiring an approval', () => {
        const ruleset = buildRuleset({
            checks: [],
            name: 'protect-main',
            requirePullRequest: true,
        })
        const rule = ruleset.rules.find(
            entry => (entry as { type: string }).type === 'pull_request'
        ) as { parameters: { required_approving_review_count: number } }
        expect(rule.parameters.required_approving_review_count).toBe(0)
    })

    test('discovered checks become required and branches must be up to date', () => {
        const ruleset = buildRuleset({
            checks: ['check', 'image'],
            name: 'protect-main',
            requirePullRequest: false,
        })
        const rule = ruleset.rules.find(
            entry =>
                (entry as { type: string }).type === 'required_status_checks'
        ) as {
            parameters: {
                required_status_checks: { context: string }[]
                strict_required_status_checks_policy: boolean
            }
        }
        expect(rule.parameters.required_status_checks).toEqual([
            { context: 'check' },
            { context: 'image' },
        ])
        expect(rule.parameters.strict_required_status_checks_policy).toBe(true)
    })
})

describe('existingChecks', () => {
    test('reads back what a ruleset already requires', () => {
        expect(
            existingChecks({
                id: 1,
                name: 'protect-main',
                rules: [
                    { type: 'deletion' },
                    {
                        parameters: {
                            required_status_checks: [
                                { context: 'image' },
                                { context: 'check' },
                            ],
                        },
                        type: 'required_status_checks',
                    },
                ],
            })
        ).toEqual(['check', 'image'])
    })

    test('a repository with no ruleset requires nothing', () => {
        expect(existingChecks(undefined)).toEqual([])
    })
})
