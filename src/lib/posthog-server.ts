import { PostHog } from "posthog-node";
import { getCloudflareContext } from "@opennextjs/cloudflare";

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

type CaptureArgs = Parameters<PostHog["capture"]>[0];

export async function captureServerEvent(event: CaptureArgs): Promise<void> {
  const client = getPostHogClient();
  client.capture(event);
  const flush = client.flush().catch((err) => {
    console.error("[posthog] flush failed:", err);
  });
  try {
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(flush);
  } catch {
    // Outside the Workers runtime (e.g. plain `next dev`): nothing to keep alive.
  }
}
