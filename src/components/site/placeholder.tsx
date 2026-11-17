type Props = {
  title: string;
  note: string;
};

/** Stand-in for routes that exist in the sitemap but are not built yet. */
export function Placeholder({ title, note }: Props) {
  return (
    <main className="flex min-h-svh flex-col justify-end px-6 pb-10 pt-32 md:px-10">
      <h1 className="text-5xl font-medium tracking-tight md:text-7xl">{title}</h1>
      <p className="mt-4 font-mono text-sm text-muted">{note}</p>
    </main>
  );
}
