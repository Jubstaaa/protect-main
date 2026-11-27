import { describe, expect, test } from 'vitest'

import type { Result } from '../src/protect.js'

import { format, report, summary } from '../src/summary.js'

function result(over: Partial<Result> = {}): Result {
    return {
        action: 'update',
        checks: ['check'],
        private: false,
        repo: 'app',
        ...over,
    }
}

describe('format', () => {
    test('a dry run says what it would do', () => {
        expect(format(result({ action: 'create' }), false)).toBe(
            'app: would create [check]'
        )
    })

    test('an applied run says what it did', () => {
        expect(format(result(), true)).toBe('app: updated [check]')
    })

    test('a repository with nothing to require says so', () => {
        expect(format(result({ checks: [] }), true)).toBe(
            'app: updated [no required checks]'
        )
    })

    test('an error replaces the report for that repository', () => {
        expect(format(result({ error: 'denied' }), true)).toBe('app: denied')
    })

    test('a private repository is never named', () => {
        expect(format(result({ private: true }), true)).toBe(
            'a private repository: updated [check]'
        )
    })

    test('a private name is stripped out of its own error', () => {
        expect(
            format(
                result({
                    error: 'GET /repos/me/app/rulesets -> 403',
                    private: true,
                    repo: 'app',
                }),
                true
            )
        ).toBe('a private repository: GET /repos/me/<redacted>/rulesets -> 403')
    })
})

describe('report', () => {
    test('names public repositories and only counts private ones', () => {
        expect(
            report(
                [
                    result({ repo: 'public-one' }),
                    result({ private: true, repo: 'secret-one' }),
                    result({ private: true, repo: 'secret-two' }),
                    result({
                        action: 'create',
                        private: true,
                        repo: 'secret-three',
                    }),
                ],
                true
            )
        ).toEqual([
            'public-one: updated [check]',
            '1 private repository: created',
            '2 private repositories: updated',
        ])
    })

    test('private failures are counted by message, not by name', () => {
        expect(
            report(
                [
                    result({
                        error: 'denied',
                        private: true,
                        repo: 'secret-one',
                    }),
                    result({
                        error: 'denied',
                        private: true,
                        repo: 'secret-two',
                    }),
                ],
                true
            )
        ).toEqual(['2 private repositories: denied'])
    })

    test('no private repository name reaches the output', () => {
        const lines = report(
            [result({ private: true, repo: 'top-secret' })],
            true
        ).join('\n')
        expect(lines).not.toContain('top-secret')
    })
})

describe('summary', () => {
    test('is a heading and one bullet per line', () => {
        expect(
            summary(
                [
                    result({ action: 'create', repo: 'one' }),
                    result({ checks: [], repo: 'two' }),
                ],
                true
            )
        ).toBe(
            '## Branch protection\n\n- one: created [check]\n- two: updated [no required checks]\n'
        )
    })

    test('says when it was a dry run', () => {
        expect(summary([], false)).toContain('(dry run)')
    })
})
