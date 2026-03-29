import Link from "next/link";
import { COPYRIGHT_YEAR } from "@/lib/utils";
import { CookieSettingsLink } from "./CookieSettingsLink";

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-rose-200/50 bg-linen-deep sm:mt-16">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:grid-cols-2 sm:px-6 sm:py-12 lg:px-8">
        <div>
          <h2 className="font-serif text-lg font-semibold text-espresso">GospelChannel</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-warm">
            Find the right church before your first visit. Compare worship style, tradition, language, and service times - all in one place.
          </p>
          <p className="mt-3 font-serif text-xs italic text-muted-warm">
            &ldquo;Praise the Lord. Praise God in his sanctuary; praise him in his mighty heavens.&rdquo; — Psalm 150:1
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-mauve">Explore</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/about" prefetch={false} className="worship-link text-warm-brown transition-colors hover:text-espresso">
                About
              </Link>
            </li>
            <li>
              <Link href="/church" prefetch={false} className="worship-link text-warm-brown transition-colors hover:text-espresso">
                Churches
              </Link>
            </li>
            <li>
              <Link href="/for-churches" prefetch={false} className="worship-link text-warm-brown transition-colors hover:text-espresso">
                For Churches
              </Link>
            </li>
            <li>
              <Link href="/tools" prefetch={false} className="worship-link text-warm-brown transition-colors hover:text-espresso">
                Free Tools
              </Link>
            </li>
            <li>
              <Link href="/compare" prefetch={false} className="worship-link text-warm-brown transition-colors hover:text-espresso">
                Compare Guides
              </Link>
            </li>
            <li>
              <Link href="/church/suggest" prefetch={false} className="worship-link text-warm-brown transition-colors hover:text-espresso">
                Add Your Church
              </Link>
            </li>
            <li>
              <Link href="/privacy" prefetch={false} className="worship-link text-warm-brown transition-colors hover:text-espresso">
                Privacy
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-rose-200/40 px-4 py-5 text-center text-xs text-muted-warm">
        <p>© {COPYRIGHT_YEAR} GospelChannel.com · Made with ♡ for the worship community</p>
        <p className="mt-1">
          <Link href="/privacy" prefetch={false} className="transition-colors hover:text-espresso">Privacy Policy</Link>
          {" · "}
          <a href="mailto:hello@gospelchannel.com" className="transition-colors hover:text-espresso">Contact</a>
          {" · "}
          <CookieSettingsLink />
        </p>
      </div>
    </footer>
  );
}
