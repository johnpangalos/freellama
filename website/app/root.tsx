import { SkipLink } from "@comp0/react";
import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { SiteFooter } from "./components/SiteFooter.tsx";
import { SiteHeader } from "./components/SiteHeader.tsx";

export const links: Route.LinksFunction = () => [
	{ rel: "icon", href: "/favicon.ico", sizes: "32x32" },
	{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="flex min-h-screen flex-col">
				<SkipLink href="#main">Skip to content</SkipLink>
				<SiteHeader />
				<main id="main" className="flex-1">
					{children}
				</main>
				<SiteFooter />
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops!";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "Error";
		details = error.status === 404
			? "The requested page could not be found."
			: error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<div className="mx-auto max-w-4xl px-4 py-16">
			<div className="border-[3px] border-ink bg-paper p-8 shadow-brutal-lg">
				<h1 className="font-mono text-6xl font-black tracking-tight uppercase">
					{message}
				</h1>
				<p className="mt-4 text-lg">{details}</p>
				{stack && (
					<pre className="
						mt-6 w-full overflow-x-auto border-[3px] border-ink bg-code p-4 font-mono
						text-sm text-paper
					">
						<code>{stack}</code>
					</pre>
				)}
			</div>
		</div>
	);
}
