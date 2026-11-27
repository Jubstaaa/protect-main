# protect-main

Keep a branch ruleset in step with the checks your pull requests actually report, across every repository you own.

Branch protection rots. You set it up once, then a workflow gets renamed, a job becomes a matrix, a repository is created and nobody remembers. This runs on a schedule and fixes all three.

```yaml
name: Protect main

on:
    schedule:
        - cron: '0 6 * * *'
    workflow_dispatch:

permissions: {}

jobs:
    protect:
        runs-on: ubuntu-latest
        steps:
            - uses: Jubstaaa/protect-main@v1
              with:
                  token: ${{ secrets.RULESET_TOKEN }}
                  apply: true
```

With no `repos`, it walks every repository the account owns — archived and forks excluded, private included — so a repository created tomorrow is protected without being named.

## What it writes

A ruleset named `protect-main` on each repository's default branch:

- the branch cannot be deleted;
- the branch cannot be force-pushed;
- changes land through a pull request — **no approval is required**, so you can still merge your own work, but nothing reaches the default branch unreviewed by CI;
- every check your pull requests report has to pass, and the branch has to be up to date.

Set `require-pull-request: false` if you push to the default branch directly.

## Where the required checks come from

Not from your workflow files. The job key in `ci.yml` is only the reported name for a plain job — a matrix job or a reusable-workflow caller reports something else entirely:

| in the workflow | what the pull request reports |
| --------------- | ----------------------------- |
| `quality-gate`  | `quality-gate (bun) / gate`   |
| `app`           | `app (rust + typescript)`     |

A ruleset that requires a context nobody reports blocks every pull request in that repository, permanently. So the contexts come from the **jobs of the workflow runs on recently merged pull requests**, which is by definition what a pull request will report. The Actions API is used rather than the Checks API: a fine-grained token cannot be granted read access to checks at all, and the job names it returns are identical — `quality-gate (bun) / gate` is reported the same way by both.

Three rules keep that honest:

- a check has to appear in **all** of the sampled pull requests (`sample-pulls`, 3 by default), so a job that only runs for Renovate never becomes required;
- only GitHub Actions jobs count, so a third-party app cannot block your merges by being removed from the repository — the Actions API returns nothing else;
- skipped jobs are ignored.

And it never weakens what is already there: if nothing is discovered — a new repository, a quiet one — whatever the ruleset already requires is kept, and the repository still gets the deletion and force-push rules.

## Private repositories are never named

The report names public repositories and only **counts** private ones:

```
acw-istanbul: updated [check, email-relay, image]
configs: updated [check]
9 private repositories: updated
2 private repositories: created
```

That holds in the log, in the job summary and in the `report` output, and a
private repository's name is stripped out of its own error message too. A
scheduled run in a public repository would otherwise publish the names of every
private repository you own, to anyone who opens the run.

Being careful about this does not make the workflow's own repository a safe
place for anything else, so keep the token in a secret and the workflow minimal.

## Inputs

| Input                  | Default                        |                                                                                                                               |
| ---------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `token`                | —                              | a token with **administration: write** on the repositories. `GITHUB_TOKEN` cannot do this and reaches only its own repository |
| `owner`                | the running repository's owner | the account that owns the repositories                                                                                        |
| `repos`                | all                            | repository names, whitespace or comma separated                                                                               |
| `apply`                | `false`                        | write the ruleset; left false it only reports what it would do                                                                |
| `require-pull-request` | `true`                         | require a pull request on the default branch                                                                                  |
| `ruleset-name`         | `protect-main`                 | the ruleset it creates and keeps updated                                                                                      |
| `sample-pulls`         | `3`                            | how many merged pull requests a check must appear in to become required                                                       |

It writes the same report to the job summary, and fails the job if any repository errored.

## The token

Rulesets are an administration-scope write, and `GITHUB_TOKEN` has neither that scope nor any reach outside its own repository. Create a fine-grained personal access token on the repositories you want covered — or on all of them, so new ones are included — with three repository permissions, and store it as a secret:

| Permission                         | Why                                       |
| ---------------------------------- | ----------------------------------------- |
| **Administration: Read and write** | the ruleset itself                        |
| **Pull requests: Read**            | finding the recently merged pull requests |
| **Checks: Read**                   | reading what those pull requests reported |

A token with only the first works on public repositories, because their pull
requests are readable by anyone, and returns 403 on every private one.

Nothing else is needed; the token is the only credential, and it never leaves the runner.

## From the command line

```sh
GITHUB_TOKEN=<token> npx github:Jubstaaa/protect-main --owner <account> --all
GITHUB_TOKEN=<token> npx github:Jubstaaa/protect-main --owner <account> --apply my-repo other-repo
```

Dry run unless you pass `--apply`. `--no-pull-request`, `--owner`, `--ruleset-name` and `--sample-pulls` match the action's inputs.

## Releasing

release-please cuts the release from the conventional commits on `main`, and a
second job moves the `v1` tag onto it, so `@v1` keeps pointing at the newest
release. The release pull request is opened with a personal access token rather
than `GITHUB_TOKEN`, because a pull request opened with the built-in token does
not start workflows, and its required checks would never report.

## License

MIT
