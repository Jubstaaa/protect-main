import { throttling } from '@octokit/plugin-throttling'
import { Octokit } from '@octokit/rest'

import type { CheckRun, Ruleset, RulesetBody } from './rules.js'

export interface Api {
    checkRuns: (repo: string, sha: string) => Promise<CheckRun[]>
    mergedPullHeads: (repo: string) => Promise<string[]>
    ownRepos: () => Promise<RepoRef[]>
    ruleset: (repo: string, id: number) => Promise<Ruleset>
    rulesets: (repo: string) => Promise<Ruleset[]>
    visibility: (names: string[]) => Promise<RepoRef[]>
    write: (repo: string, body: RulesetBody, id?: number) => Promise<void>
}

export interface RepoRef {
    name: string
    private: boolean
}

const Throttled = Octokit.plugin(throttling)

export function createApi(token: string, owner: string): Api {
    const octokit = new Throttled({
        auth: token,
        throttle: {
            onRateLimit: (retryAfter, options, _octokit, retryCount) =>
                retryCount < 2,
            onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) =>
                retryCount < 2,
        },
    })

    return {
        checkRuns: async (repo, sha) => {
            const { data } = await octokit.checks.listForRef({
                owner,
                per_page: 100,
                ref: sha,
                repo,
            })

            return data.check_runs as unknown as CheckRun[]
        },
        mergedPullHeads: async repo => {
            const { data } = await octokit.pulls.list({
                direction: 'desc',
                owner,
                per_page: 20,
                repo,
                sort: 'updated',
                state: 'closed',
            })

            return data
                .filter(pull => pull.merged_at !== null)
                .map(pull => pull.head.sha)
        },
        ownRepos: async () => {
            const repos = await octokit.paginate(
                octokit.repos.listForAuthenticatedUser,
                { affiliation: 'owner', per_page: 100 }
            )

            return repos
                .filter(repo => !repo.archived && !repo.fork)
                .filter(
                    repo =>
                        repo.owner.login.toLowerCase() === owner.toLowerCase()
                )
                .map(repo => ({ name: repo.name, private: repo.private }))
                .sort((left, right) => left.name.localeCompare(right.name))
        },
        ruleset: async (repo, id) => {
            const response = await octokit.request(
                'GET /repos/{owner}/{repo}/rulesets/{id}',
                { id, owner, repo }
            )

            const ruleset: unknown = response.data

            return ruleset as Ruleset
        },
        rulesets: async repo => {
            const response = await octokit.request(
                'GET /repos/{owner}/{repo}/rulesets',
                { owner, repo }
            )
            const rulesets: unknown = response.data

            return rulesets as Ruleset[]
        },
        visibility: async names => {
            const refs: RepoRef[] = []
            for (const name of names) {
                const { data } = await octokit.repos.get({ owner, repo: name })
                refs.push({ name, private: data.private })
            }

            return refs
        },
        write: async (repo, body, id) => {
            await octokit.request(
                id === undefined
                    ? 'POST /repos/{owner}/{repo}/rulesets'
                    : 'PUT /repos/{owner}/{repo}/rulesets/{id}',
                { ...body, id, owner, repo } as never
            )
        },
    }
}
