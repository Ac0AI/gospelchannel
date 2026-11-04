import { describe, expect, it, vi } from "vitest";
import { dispatchReconcileWorkflow } from "../reconcile-dispatch";

describe("dispatchReconcileWorkflow", () => {
  it("asks GitHub to run the reconcile workflow on main", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    await dispatchReconcileWorkflow({ GITHUB_DISPATCH_TOKEN: "token" }, fetchImpl as unknown as typeof fetch);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/Ac0AI/gospelchannel/actions/workflows/reconcile-directory.yml/dispatches");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer token");
    expect(JSON.parse(String(init.body))).toEqual({ ref: "main" });
  });

  it("fails loudly when GitHub refuses, so the cron shows up as failed", async () => {
    const fetchImpl = vi.fn(async () => new Response("Bad credentials", { status: 401 }));
    await expect(dispatchReconcileWorkflow({ GITHUB_DISPATCH_TOKEN: "expired" }, fetchImpl as unknown as typeof fetch))
      .rejects.toThrow(/401 Bad credentials/);
  });

  it("fails loudly without a token", async () => {
    await expect(dispatchReconcileWorkflow({})).rejects.toThrow(/GITHUB_DISPATCH_TOKEN is not set/);
  });
});
