import type { Api } from '../src/api.js'
import type { CheckRun, Ruleset, RulesetBody } from '../src/rules.js'

export interface FakeState {
    checkRuns?: Record<string, CheckRun[]>
    failOn?: string[]
    heads?: Record<string, string[]>
    privateRepos?: string[]
    repos?: string[]
    rulesets?: Record<string, Ruleset[]>
}

export interface Written {
    body: RulesetBody
    id: number | undefined
    repo: string
}

export function actionsRun(name: string, conclusion = 'success'): CheckRun {
    return { app: { slug: 'github-actions' }, conclusion, name }
}

export function fakeApi(state: FakeState): { api: Api; written: Written[] } {
    const written: Written[] = []
    const api: Api = {
        checkRuns: (repo, sha) =>
            Promise.resolve(state.checkRuns?.[`${repo}@${sha}`] ?? []),
        mergedPullHeads: repo => Promise.resolve(state.heads?.[repo] ?? []),
        ownRepos: () =>
            Promise.resolve(
                (state.repos ?? []).map(name => ({
                    name,
                    private: state.privateRepos?.includes(name) ?? false,
                }))
            ),
        ruleset: (repo, id) =>
            Promise.resolve(
                (state.rulesets?.[repo] ?? []).find(rule => rule.id === id) ?? {
                    id,
                    name: 'protect-main',
                }
            ),
        rulesets: repo => {
            if (state.failOn?.includes(repo)) {
                return Promise.reject(new Error('no administration access'))
            }

            return Promise.resolve(state.rulesets?.[repo] ?? [])
        },
        visibility: names =>
            Promise.resolve(
                names.map(name => ({
                    name,
                    private: state.privateRepos?.includes(name) ?? false,
                }))
            ),
        write: (repo, body, id) => {
            written.push({ body, id, repo })

            return Promise.resolve()
        },
    }

    return { api, written }
}
