const RECONCILE_WORKFLOW_DISPATCH_URL =
  "https://api.github.com/repos/Ac0AI/gospelchannel/actions/workflows/reconcile-directory.yml/dispatches";

/**
 * Starts the nightly directory reconcile (.github/workflows/reconcile-directory.yml).
 *
 * The reconcile runs in GitHub Actions because its Node jobs are too heavy for
 * a Worker isolate. GitHub starts scheduled workflows hours late, though (5-7 h
 * in November 2026), so the "02:33" job ran in the middle of the day's traffic
 * and its database load reached visitors. The Worker cron fires on time and
 * asks GitHub to start the workflow now. GitHub's own late schedule stays as
 * the fallback and skips itself when this run already succeeded.
 *
 * Needs GITHUB_DISPATCH_TOKEN: a fine-grained token for Ac0AI/gospelchannel
 * with Actions read and write, nothing else.
 */
export async function dispatchReconcileWorkflow(
  env: { GITHUB_DISPATCH_TOKEN?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const token = env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    throw new Error("GITHUB_DISPATCH_TOKEN is not set: the nightly reconcile was not started (GitHub's late schedule is the fallback).");
  }
  const response = await fetchImpl(RECONCILE_WORKFLOW_DISPATCH_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "gospelchannel-worker",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({ ref: "main" }),
  });
  if (response.status !== 204) {
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    throw new Error(`Starting the nightly reconcile failed: GitHub answered ${response.status} ${detail}`);
  }
}
