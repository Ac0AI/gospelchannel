const OPENAI_APPS_CHALLENGE =
  "G6qd3NjvwgN-0vXPPz7zCnvHv5dv31d_LTuBNA5E6A4";

export const dynamic = "force-static";

export function GET() {
  return new Response(OPENAI_APPS_CHALLENGE, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
