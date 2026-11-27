import * as core from '@actions/core'

import type { Inputs } from './inputs.js'

import { createApi } from './api.js'
import { run } from './protect.js'
import { report, summary } from './summary.js'

export async function main(inputs: Inputs): Promise<void> {
    const api = createApi(inputs.token, inputs.owner)
    const results = await run(api, inputs)

    const lines = report(results, inputs.apply)
    for (const line of lines) core.info(line)
    core.setOutput('report', lines.join('\n'))
    await core.summary.addRaw(summary(results, inputs.apply)).write()

    const failed = results.filter(result => result.error !== undefined)
    if (failed.length > 0) {
        core.setFailed(
            `${String(failed.length)} of ${String(results.length)} repositories failed`
        )
    }
}
