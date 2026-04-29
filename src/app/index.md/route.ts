import { buildIndexMarkdown, discoveryHeaders } from "@/lib/agent-discovery";
import { getChurchStatsAsync } from "@/lib/content";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  const stats = await getChurchStatsAsync();
  return new Response(buildIndexMarkdown(stats), {
    headers: discoveryHeaders("text/markdown; charset=utf-8"),
  });
}
