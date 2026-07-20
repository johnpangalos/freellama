import { Link } from "@comp0/react";
import { Link as RouterLink } from "react-router";

const navLinkClass =
	"border-2 border-transparent px-2 py-1 font-mono text-sm font-bold uppercase tracking-wide data-hovered:border-ink data-hovered:bg-lime data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-blue";

export function SiteHeader() {
	return (
		<header className="sticky top-0 z-10 border-b-[3px] border-ink bg-paper">
			<div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
				<Link
					as={RouterLink}
					to="/"
					className="font-mono text-xl font-black tracking-tight data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-blue"
				>
					freellama<span className="text-accent">_</span>
				</Link>
				<nav className="flex items-center gap-2" aria-label="Site">
					<Link as={RouterLink} to="/docs" className={navLinkClass}>
						docs
					</Link>
					<Link
						href="https://github.com/johnpangalos/freellama"
						className={navLinkClass}
					>
						github
					</Link>
				</nav>
			</div>
		</header>
	);
}
