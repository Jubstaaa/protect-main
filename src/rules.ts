export interface Job {
    conclusion: null | string
    name: string
}

export interface Ruleset {
    id: number
    name: string
    rules?: RulesetRule[]
}

export interface RulesetBody {
    conditions: { ref_name: { exclude: string[]; include: string[] } }
    enforcement: string
    name: string
    rules: unknown[]
    target: string
}

export interface RulesetRule {
    parameters?: { required_status_checks?: { context: string }[] }
    type: string
}

export function buildRuleset({
    checks,
    name,
    requirePullRequest,
}: {
    checks: string[]
    name: string
    requirePullRequest: boolean
}): RulesetBody {
    const rules: unknown[] = [
        { type: 'deletion' },
        { type: 'non_fast_forward' },
    ]

    if (requirePullRequest) {
        rules.push({
            parameters: {
                dismiss_stale_reviews_on_push: false,
                require_code_owner_review: false,
                require_last_push_approval: false,
                required_approving_review_count: 0,
                required_review_thread_resolution: false,
            },
            type: 'pull_request',
        })
    }

    if (checks.length > 0) {
        rules.push({
            parameters: {
                required_status_checks: checks.map(context => ({ context })),
                strict_required_status_checks_policy: true,
            },
            type: 'required_status_checks',
        })
    }

    return {
        conditions: { ref_name: { exclude: [], include: ['~DEFAULT_BRANCH'] } },
        enforcement: 'active',
        name,
        rules,
        target: 'branch',
    }
}

export function existingChecks(ruleset: Ruleset | undefined): string[] {
    return (ruleset?.rules ?? [])
        .flatMap(rule => rule.parameters?.required_status_checks ?? [])
        .map(check => check.context)
        .sort()
}

export function intersect(samples: Set<string>[]): string[] {
    const [first, ...rest] = samples
    if (!first) return []

    return [...first]
        .filter(name => rest.every(other => other.has(name)))
        .sort()
}

export function reportedChecks(jobs: Job[]): Set<string> {
    return new Set(
        jobs.filter(job => job.conclusion !== 'skipped').map(job => job.name)
    )
}
