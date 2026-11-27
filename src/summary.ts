import type { Result } from './protect.js'

export function format(result: Result, apply: boolean): string {
    const name = result.private ? 'a private repository' : result.repo
    if (result.error !== undefined) {
        return `${name}: ${redact(result.error, result)}`
    }

    return `${name}: ${verb(result.action, apply)} [${checksOf(result)}]`
}

export function report(results: Result[], apply: boolean): string[] {
    const lines = results
        .filter(result => !result.private)
        .map(result => format(result, apply))
    const hidden = results.filter(result => result.private)

    for (const action of ['create', 'update'] as const) {
        const count = hidden.filter(
            result => result.error === undefined && result.action === action
        ).length
        if (count > 0) {
            lines.push(`${plural(count)}: ${verb(action, apply)}`)
        }
    }

    const failures = new Map<string, number>()
    for (const result of hidden) {
        if (result.error === undefined) continue
        const message = redact(result.error, result)
        failures.set(message, (failures.get(message) ?? 0) + 1)
    }
    for (const [message, count] of failures) {
        lines.push(`${plural(count)}: ${message}`)
    }

    return lines
}

export function summary(results: Result[], apply: boolean): string {
    const heading = apply ? 'Branch protection' : 'Branch protection (dry run)'
    const lines = report(results, apply).map(line => `- ${line}`)

    return `## ${heading}\n\n${lines.join('\n')}\n`
}

function checksOf(result: Result): string {
    return result.checks.join(', ') || 'no required checks'
}

function plural(count: number): string {
    return `${String(count)} private ${count === 1 ? 'repository' : 'repositories'}`
}

function redact(message: string, result: Result): string {
    if (!result.private) return message

    return message.replaceAll(result.repo, '<redacted>')
}

function verb(action: Result['action'], apply: boolean): string {
    if (!apply) return `would ${action}`

    return action === 'create' ? 'created' : 'updated'
}
