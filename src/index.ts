import * as core from '@actions/core'

import { readInputs } from './inputs.js'
import { main } from './main.js'

try {
    await main(readInputs())
} catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error))
}
