import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { ALTERNATIVES } from "@/lib/alternatives-data";
import { AlternativeLayout } from "@/components/AlternativeLayout";
import CompareHubPage from "@/app/compare/page";
import BestWorshipChurchesPage, {
  generateMetadata as generateBestWorshipMetadata,
} from "@/app/church/best-worship-churches/page";
import NetworkIndexPage from "@/app/network/page";

vi.mock("@/lib/content", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content")>()),
  getFreshestChurchUpdatedAtAsync: async () => "2026-07-10T00:00:00.000Z",
}));

vi.mock("@/lib/discovery-churches", () => ({
  getBestWorshipChurches: async () => [
    {
      name: "Sample Worship Church",
      slug: "sample-worship-church",
      location: "London",
      country: "United Kingdom",
      website: "https://example.com",
      denomination: "Pentecostal",
      musicStyle: ["contemporary worship"],
      language: "en",
      headerImage: null,
      logo: null,
      serviceTimeLabel: "Sunday 10:00",
      playlistCount: 1,
      videoCount: 2,
      directoryScore: 92,
    },
  ],
  formatDiscoveryStyles: (styles: string[] | null) => styles?.join(", ") ?? null,
  buildDiscoveryChurchProofs: () => ["Service time listed: Sunday 10:00"],
}));

vi.mock("@/lib/church-networks", () => ({
  getAllNetworks: async () => [
    {
      id: "network-1",
      slug: "sample-network",
      name: "Sample Network",
      headquartersCountry: "United Kingdom",
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z",
    },
  ],
}));

const FORBIDDEN_PUBLIC_COPY = [
  /\bproof routes?\b/i,
  /\bproof layers?\b/i,
  /\bdatabase proof\b/i,
  /\bproof database\b/i,
  /\bprofile (?:proof|evidence)\b/i,
  /\bdecision (?:engines?|paths?|routes?)\b/i,
  /\banswer maps?\b/i,
  /\brequire evidence\b/i,
  /\bproof profiles?\b/i,
  /\bverify fit\b/i,
  /\bproof links?\b/i,
  /\bdoes the proof work\b/i,
  /\bproved through a real church profile\b/i,
  /\banswers you can verify\b/i,
  /\b(?:recommended|matching) routes?\b/i,
  /\bsame lane\b/i,
  /\bprofile signals?\b/i,
  /\banswer first[.!?]?\s+verify second\b/i,
  /\bverify the fit\b/i,
];

const SRC_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PUBLIC_ROOTS = ["app", "components"];
const PUBLIC_COPY_LIBS = [
  "lib/church-choice-answers.ts",
  "lib/church-metadata.ts",
  "lib/for-audience-data.ts",
  "lib/search-suggestions.ts",
  "lib/seo-schema.ts",
  "lib/tooling.ts",
];
const EXCLUDED_PUBLIC_DIRECTORIES = new Set([
  "app/.well-known",
  "app/admin",
  "app/api",
  "app/church-admin",
  "app/index.md",
  "app/llms-full.txt",
  "app/llms.txt",
  "app/sitemap-chunk",
  "app/sitemap.xml",
  "components/admin",
  "components/church-admin",
]);

function isExcluded(relativePath: string): boolean {
  return [...EXCLUDED_PUBLIC_DIRECTORIES].some(
    (excluded) => relativePath === excluded || relativePath.startsWith(`${excluded}/`),
  );
}

function collectSourceFiles(relativeDirectory: string): string[] {
  if (isExcluded(relativeDirectory)) return [];

  return readdirSync(`${SRC_ROOT}/${relativeDirectory}`, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) return collectSourceFiles(relativePath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [relativePath] : [];
  });
}

function isPropertyName(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent)) &&
    parent.name === node
  );
}

function isModuleSpecifier(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) &&
    parent.moduleSpecifier === node
  );
}

function collectVisitorStrings(relativePath: string): string[] {
  const source = readFileSync(`${SRC_ROOT}/${relativePath}`, "utf8");
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const strings: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxText(node)) {
      strings.push(node.getText(sourceFile));
    } else if (ts.isStringLiteralLike(node) && !isPropertyName(node) && !isModuleSpecifier(node)) {
      strings.push(node.text);
    } else if (
      node.kind === ts.SyntaxKind.TemplateHead ||
      node.kind === ts.SyntaxKind.TemplateMiddle ||
      node.kind === ts.SyntaxKind.TemplateTail
    ) {
      strings.push((node as ts.TemplateLiteralLikeNode).text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return strings;
}

const PUBLIC_COPY_FILES = [
  ...PUBLIC_ROOTS.flatMap(collectSourceFiles),
  ...PUBLIC_COPY_LIBS,
].sort();

describe("public copy", () => {
  it("uses visitor language across every public route and shared component", () => {
    for (const relativePath of PUBLIC_COPY_FILES) {
      const visitorCopy = collectVisitorStrings(relativePath).join("\n");
      for (const pattern of FORBIDDEN_PUBLIC_COPY) {
        expect(visitorCopy, `${relativePath} contains ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("renders CTA labels at their actual destinations", async () => {
    const compareMarkup = renderToStaticMarkup(createElement(CompareHubPage));
    const alternativeMarkup = renderToStaticMarkup(
      createElement(AlternativeLayout, {
        data: ALTERNATIVES.churchfinder,
        siblings: [],
      }),
    );
    const networkMarkup = renderToStaticMarkup(await NetworkIndexPage());

    expect(compareMarkup).toContain('href="/church">Browse churches</a>');
    expect(alternativeMarkup).toContain('href="/church">Browse churches</a>');
    expect(networkMarkup).toContain('href="/network/sample-network"');
    expect(networkMarkup).toContain("https://gospelchannel.com/network/sample-network");
  });

  it("keeps private-preview comparison columns shrinkable on mobile", async () => {
    const previewModule = await import("@/app/preview/[slug]/preview-comparison-column");
    const PreviewComparisonColumn = (
      previewModule as unknown as {
        PreviewComparisonColumn?: ComponentType<{ children: ReactNode }>;
      }
    ).PreviewComparisonColumn;

    expect(PreviewComparisonColumn).toBeTypeOf("function");
    const markup = renderToStaticMarkup(
      createElement(PreviewComparisonColumn!, null, createElement("span", null, "Preview")),
    );

    expect(markup).toBe('<div class="min-w-0"><span>Preview</span></div>');
  });

  it("describes the best-worship collection by its filter and profile-completeness ordering", async () => {
    const metadata = await generateBestWorshipMetadata();
    const markup = renderToStaticMarkup(await BestWorshipChurchesPage());
    const jsonLdMarkup = markup.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    )?.[1];
    const jsonLd = JSON.parse(jsonLdMarkup ?? "[]") as Array<Record<string, unknown>>;
    const breadcrumbSchema = jsonLd.find((item) => item["@type"] === "BreadcrumbList") as
      | { itemListElement?: Array<{ name?: string }> }
      | undefined;
    const itemListSchema = jsonLd.find((item) => item["@type"] === "ItemList");

    expect(metadata.title).toBe("Churches Known for Worship");
    expect(metadata.description).toContain("contemporary, charismatic, gospel, or Pentecostal worship");
    expect(metadata.description).toContain("profile completeness");
    expect(markup).toContain("Churches Known for");
    expect(markup).toContain(">Churches Known for Worship</span>");
    expect(markup).toContain("filtered by published worship tags");
    expect(markup).toContain("ordered by GospelChannel&#x27;s directory score for profile completeness");
    expect(markup).not.toMatch(/What People Recommend|people recommend for worship/i);
    expect(breadcrumbSchema?.itemListElement?.at(-1)?.name).toBe("Churches Known for Worship");
    expect(itemListSchema?.name).toBe("Churches Known for Worship");
  });
});
