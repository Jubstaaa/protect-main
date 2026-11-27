export function buildRuleset({ checks, name, requirePullRequest }) {
    const rules = [{ type: 'deletion' }, { type: 'non_fast_forward' }]

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

export function existingChecks(ruleset) {
    return (ruleset?.rules ?? [])
        .flatMap(rule => rule.parameters?.required_status_checks ?? [])
        .map(check => check.context)
        .sort()
}

export function intersect(sets) {
    const [first, ...rest] = sets
    if (!first) return []

    return [...first]
        .filter(name => rest.every(other => other.has(name)))
        .sort()
}

export function reportedChecks(runs) {
    return new Set(
        runs
            .filter(run => run.app?.slug === 'github-actions')
            .filter(run => run.conclusion !== 'skipped')
            .map(run => run.name)
    )
}
