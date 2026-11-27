import { createClient } from './github.mjs'
import {
    buildRuleset,
    existingChecks,
    intersect,
    reportedChecks,
} from './rules.mjs'

export async function discoverChecks(gh, owner, repo, samplePulls) {
    const pulls = await gh(
        `/repos/${owner}/${repo}/pulls?state=closed&per_page=20&sort=updated&direction=desc`
    ).catch(() => [])

    const samples = []
    for (const pull of pulls) {
        if (pull.merged_at === null) continue
        if (samples.length === samplePulls) break
        const body = await gh(
            `/repos/${owner}/${repo}/commits/${pull.head.sha}/check-runs?per_page=100`
        ).catch(() => ({ check_runs: [] }))
        const names = reportedChecks(body.check_runs)
        if (names.size > 0) samples.push(names)
    }

    return intersect(samples)
}

export function format(result, apply) {
    if (result.error) return `${result.repo}: ${result.error}`
    const checks = result.checks.join(', ') || 'no required checks'
    const verb = apply
        ? result.action === 'create'
            ? 'created'
            : 'updated'
        : `would ${result.action}`

    return `${result.repo}: ${verb} [${checks}]`
}

export async function ownRepos(gh, owner) {
    const names = []
    for (let page = 1; ; page += 1) {
        const batch = await gh(
            `/user/repos?affiliation=owner&per_page=100&page=${page}`
        )
        for (const repo of batch) {
            if (repo.archived || repo.fork) continue
            if (repo.owner.login.toLowerCase() !== owner.toLowerCase()) continue
            names.push(repo.name)
        }
        if (batch.length < 100) break
    }

    return names.sort()
}

export async function protect(gh, owner, repo, options) {
    const rulesets = await gh(`/repos/${owner}/${repo}/rulesets`)
    const found = rulesets.find(rule => rule.name === options.name)
    const discovered = await discoverChecks(
        gh,
        owner,
        repo,
        options.samplePulls
    )
    const kept = found
        ? existingChecks(
              await gh(`/repos/${owner}/${repo}/rulesets/${found.id}`)
          )
        : []
    const checks = discovered.length > 0 ? discovered : kept
    const body = buildRuleset({
        checks,
        name: options.name,
        requirePullRequest: options.requirePullRequest,
    })
    const action = found ? 'update' : 'create'

    if (options.apply) {
        await gh(
            found
                ? `/repos/${owner}/${repo}/rulesets/${found.id}`
                : `/repos/${owner}/${repo}/rulesets`,
            { body: JSON.stringify(body), method: found ? 'PUT' : 'POST' }
        )
    }

    return { action, checks, repo }
}

export async function run(options) {
    const gh = createClient(options.token)
    const repos =
        options.repos.length > 0
            ? options.repos
            : await ownRepos(gh, options.owner)
    const results = []

    for (const repo of repos) {
        try {
            results.push(await protect(gh, options.owner, repo, options))
        } catch (error) {
            results.push({ error: String(error), repo })
        }
    }

    return results
}
