// Hand-written explainer + FAQ for denomination hubs where people search for
// what the tradition is, not only for a list ("non denominational church" is
// mostly asked as a question). Facts about worship come from the playlist
// study in src/data/worship-by-denomination-2026.json, never from the
// denomination-primed music_style field.
import type { HubEditorial } from "@/lib/hub-content";
import worshipByDenomination from "@/data/worship-by-denomination-2026.json";

function familyStats(family: string) {
  return worshipByDenomination.families.find((f) => f.family === family) ?? null;
}

function buildNonDenominationalEditorial(totalCount: number): HubEditorial {
  const count = totalCount.toLocaleString("en-US");
  const stats = familyStats("Non-denominational");
  const topSongs = stats ? stats.topSongs.slice(0, 4).map((s) => s.title) : [];
  const songList =
    topSongs.length > 1 ? `${topSongs.slice(0, -1).join(", ")} and ${topSongs[topSongs.length - 1]}` : topSongs[0] ?? "";

  const worshipSentence = stats
    ? `In our study of real church playlists, ${stats.megachurchAnthemPct}% of non-denominational churches sang songs from Hillsong, Bethel, Elevation or Passion, the highest share of any tradition, while ${stats.modernHymnPct}% sang a modern hymn from the Gettys, CityAlight or Sovereign Grace. Their most-played songs were ${songList}.`
    : "";

  return {
    intro: [
      "A non-denominational church is a Protestant church that is not part of a denomination such as the Southern Baptist Convention, the Assemblies of God or the United Methodist Church. It decides its beliefs, leadership and style locally, usually around a short statement of faith that most evangelical churches would recognise.",
      `That independence shows most on Sunday. Many non-denominational churches lean contemporary: a band, modern worship songs, casual dress and a sermon at the centre. ${worshipSentence}`.trim(),
      `GospelChannel lists ${count} non-denominational churches. With no denomination to vouch for what a church teaches, check three things before you visit: the statement of faith on the church's own website, who leads it and who they answer to, and what Sunday actually sounds like. The profiles below show service times, location and, where the church shares it, the music it sings.`,
    ],
    faqs: [
      {
        question: "What is a non-denominational church?",
        answer:
          "A Protestant church that does not belong to a denomination. It sets its own beliefs, leadership and style locally instead of following a national body such as the Southern Baptist Convention or the Assemblies of God. Most are evangelical in belief.",
      },
      {
        question: "What is the difference between a denominational and a non-denominational church?",
        answer:
          "A denominational church belongs to a wider body that sets shared beliefs, approves pastors and often provides oversight. A non-denominational church makes those decisions itself. Beliefs are often close to evangelical denominations; the real difference is who holds authority and how much one church can differ from the next.",
      },
      {
        question: "What do non-denominational churches believe?",
        answer:
          "Most hold core evangelical beliefs: the Trinity, salvation through faith in Jesus, the authority of the Bible and, usually, believer's baptism. Beyond that they vary, for example on spiritual gifts or women in leadership, so read the statement of faith of the specific church you plan to visit.",
      },
      {
        question: "Are non-denominational churches accountable to anyone?",
        answer:
          "It depends on the church. Some are led by an elder board, some by a founding pastor with a board of directors, and many belong to a network such as the Association of Related Churches, Acts 29 or Calvary Chapel that offers support without being a denomination. It is a fair question to ask who the pastor answers to.",
      },
      ...(stats
        ? [
            {
              question: "What is worship like at a non-denominational church?",
              answer: `Usually contemporary and band-led. Across ${stats.churches} non-denominational churches in our playlist study, ${stats.megachurchAnthemPct}% sang Hillsong, Bethel, Elevation or Passion songs, more than any other tradition, and the most common were ${songList}. Modern hymns were less common (${stats.modernHymnPct}%) than in Baptist churches (${familyStats("Baptist")?.modernHymnPct ?? 60}%).`,
            },
          ]
        : []),
    ],
  };
}

export function getDenominationEditorial(slug: string, totalCount: number): HubEditorial | null {
  if (slug === "non-denominational") return buildNonDenominationalEditorial(totalCount);
  return null;
}
