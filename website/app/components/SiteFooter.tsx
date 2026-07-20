import { Link, Separator } from "@comp0/react";

export function SiteFooter() {
	return (
		<footer className="mt-16">
			<Separator className="block border-t-[3px] border-ink" />
			<div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-6 font-mono text-xs tracking-wide uppercase">
				<p>Public domain (Unlicense). No registry. No accounts. No telemetry.</p>
				<Link
					href="https://github.com/johnpangalos/freellama"
					className="underline decoration-2 underline-offset-4 data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-blue data-hovered:bg-lime"
				>
					github.com/johnpangalos/freellama
				</Link>
			</div>
		</footer>
	);
}
