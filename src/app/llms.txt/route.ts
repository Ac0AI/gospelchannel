import { buildLlmsTxt, discoveryHeaders } from "@/lib/agent-discovery";
import { getChurchStatsAsync } from "@/lib/content";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  const stats = await getChurchStatsAsync();
  return new Response(buildLlmsTxt(stats), {
    headers: discoveryHeaders("text/plain; charset=utf-8"),
  });
}
