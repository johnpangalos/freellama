import type { ReactNode } from "react";

type CommandSectionProps = {
  id: string;
  title: string;
  summary: string;
  children?: ReactNode;
};

export function CommandSection({
  id,
  title,
  summary,
  children,
}: CommandSectionProps) {
  return (
    <section id={id} className="scroll-mt-24 py-8">
      <h2 className="mb-1">
        <a
          href={`#${id}`}
          className="
            inline-block border-[3px] border-ink bg-accent px-3 py-1 font-mono
            text-lg font-bold text-paper shadow-brutal-sm
            sm:text-xl
          "
        >
          {title}
        </a>
      </h2>
      <p className="mt-4 max-w-prose text-base leading-relaxed">{summary}</p>
      {children}
    </section>
  );
}
