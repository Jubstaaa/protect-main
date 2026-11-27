import type { Api } from './api.js'

import {
    buildRuleset,
    existingChecks,
    intersect,
    reportedChecks,
} from './rules.js'

export interface Options {
    apply: boolean
    name: string
    repos: string[]
    requirePullRequest: boolean
    samplePulls: number
}

export interface Result {
    action: 'create' | 'update'
    checks: string[]
    error?: string
    private: boolean
    repo: string
}

export async function discoverChecks(
    api: Api,
    repo: string,
    samplePulls: number
): Promise<string[]> {
    const heads = await api.mergedPullHeads(repo).catch(() => [])
    const samples: Set<string>[] = []

    for (const sha of heads) {
        if (samples.length === samplePulls) break
        const runs = await api.checkRuns(repo, sha).catch(() => [])
        const names = reportedChecks(runs)
        if (names.size > 0) samples.push(names)
    }

    return intersect(samples)
}

export async function protect(
    api: Api,
    repo: string,
    isPrivate: boolean,
    options: Options
): Promise<Result> {
    const found = (await api.rulesets(repo)).find(
        rule => rule.name === options.name
    )
    const discovered = await discoverChecks(api, repo, options.samplePulls)
    const kept = found ? existingChecks(await api.ruleset(repo, found.id)) : []
    const checks = discovered.length > 0 ? discovered : kept

    if (options.apply) {
        await api.write(
            repo,
            buildRuleset({
                checks,
                name: options.name,
                requirePullRequest: options.requirePullRequest,
            }),
            found?.id
        )
    }

    return {
        action: found ? 'update' : 'create',
        checks,
        private: isPrivate,
        repo,
    }
}

export async function run(api: Api, options: Options): Promise<Result[]> {
    const repos =
        options.repos.length > 0
            ? await api.visibility(options.repos)
            : await api.ownRepos()
    const results: Result[] = []

    for (const { name, private: isPrivate } of repos) {
        try {
            results.push(await protect(api, name, isPrivate, options))
        } catch (error) {
            results.push({
                action: 'update',
                checks: [],
                error: error instanceof Error ? error.message : String(error),
                private: isPrivate,
                repo: name,
            })
        }
    }

    return results
}
