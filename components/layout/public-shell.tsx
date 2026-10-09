import Link from "next/link";
import { BrandLogo } from "@/components/layout/brand-mark";
import { BRAND } from "@/lib/brand";
import { marketingNav } from "@/lib/navigation";

const FOOTER_LINKS = [
  ...marketingNav.map((item) => ({ href: `/#${item.section}`, label: item.label })),
  { href: "/businesses", label: "Assess your business" },
  { href: "/login", label: "Sign in" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-[#dce5de] bg-[#fafbf8] text-[#0b1d29]">
      <div className="mx-auto grid max-w-[84rem] gap-12 px-6 py-16 sm:px-10 lg:grid-cols-12 lg:px-14 lg:py-20">
        <div className="lg:col-span-7">
          <Link href="/" className="inline-flex items-center gap-3 no-underline">
            <BrandLogo className="h-10 w-10" />
            <span className="font-display text-[1.4rem] font-semibold tracking-[0.04em]">{BRAND.name}</span>
          </Link>
          <p className="mt-5 font-display text-[1.15rem] leading-snug">{BRAND.tagline}</p>
          <p className="mt-3 max-w-sm text-[0.875rem] leading-relaxed text-[#536471]">{BRAND.description}</p>
        </div>
        <nav aria-label="Footer" className="lg:col-span-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#536471]">Platform</p>
          <ul className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2.5 text-[0.9rem]">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-[#0b1d29] no-underline transition-colors hover:text-[#0b896b]">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-[#dce5de]">
        <div className="mx-auto flex max-w-[84rem] flex-col gap-2 px-6 py-6 text-[0.75rem] text-[#536471] sm:px-10 md:flex-row md:justify-between lg:px-14">
          <p>© {new Date().getFullYear()} {BRAND.name}. Research prototype; not a credit rating or lending decision.</p>
          <p>Weather data by Open-Meteo.com · Contains modified Copernicus Sentinel and ERA5 data.</p>
        </div>
      </div>
    </footer>
  );
}
