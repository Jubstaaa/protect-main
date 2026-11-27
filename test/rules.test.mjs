import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
    buildRuleset,
    existingChecks,
    intersect,
    reportedChecks,
} from '../src/rules.mjs'

test('a check must appear in every sampled pull request', () => {
    const samples = [
        new Set(['check', 'auto-merge']),
        new Set(['check']),
        new Set(['check', 'image']),
    ]
    assert.deepEqual(intersect(samples), ['check'])
})

test('no samples means no required checks', () => {
    assert.deepEqual(intersect([]), [])
})

test('a single sample is taken as it is', () => {
    assert.deepEqual(intersect([new Set(['b', 'a'])]), ['a', 'b'])
})

test('only GitHub Actions runs count, and skipped ones do not', () => {
    const runs = [
        {
            app: { slug: 'github-actions' },
            conclusion: 'success',
            name: 'check',
        },
        {
            app: { slug: 'github-actions' },
            conclusion: 'skipped',
            name: 'auto-merge',
        },
        {
            app: { slug: 'gitguardian' },
            conclusion: 'success',
            name: 'Security',
        },
        { app: null, conclusion: 'success', name: 'orphan' },
    ]
    assert.deepEqual([...reportedChecks(runs)], ['check'])
})

test('deletion and non-fast-forward are always rules', () => {
    const ruleset = buildRuleset({
        checks: [],
        name: 'protect-main',
        requirePullRequest: false,
    })
    assert.deepEqual(
        ruleset.rules.map(rule => rule.type),
        ['deletion', 'non_fast_forward']
    )
    assert.deepEqual(ruleset.conditions.ref_name.include, ['~DEFAULT_BRANCH'])
})

test('a pull request is required without requiring an approval', () => {
    const ruleset = buildRuleset({
        checks: [],
        name: 'protect-main',
        requirePullRequest: true,
    })
    const rule = ruleset.rules.find(entry => entry.type === 'pull_request')
    assert.equal(rule.parameters.required_approving_review_count, 0)
})

test('discovered checks become required and branches must be up to date', () => {
    const ruleset = buildRuleset({
        checks: ['check', 'image'],
        name: 'protect-main',
        requirePullRequest: false,
    })
    const rule = ruleset.rules.find(
        entry => entry.type === 'required_status_checks'
    )
    assert.deepEqual(rule.parameters.required_status_checks, [
        { context: 'check' },
        { context: 'image' },
    ])
    assert.equal(rule.parameters.strict_required_status_checks_policy, true)
})

test('what a ruleset already requires can be read back', () => {
    const checks = existingChecks({
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
    assert.deepEqual(checks, ['check', 'image'])
    assert.deepEqual(existingChecks(undefined), [])
})
