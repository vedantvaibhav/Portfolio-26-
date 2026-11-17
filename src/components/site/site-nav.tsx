import Link from "next/link";

const links = [
  { href: "/craft", label: "Craft" },
  { href: "/skill", label: "Skill" },
  { href: "/writing", label: "Writing" },
  { href: "/about", label: "About" },
] as const;

export function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 text-sm md:px-10">
      <Link href="/" className="font-medium">
        Vedant Vaibhav
      </Link>
      <nav aria-label="Main">
        <ul className="flex gap-5">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="text-muted hover:text-foreground">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
