import { Button, Tab, TabList, TabPanel, Tabs } from "@comp0/react";
import { Link as RouterLink } from "react-router";

import type { Route } from "./+types/home";
import { CodeBlock } from "../components/CodeBlock";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "freellama — run LLMs locally" },
		{
			name: "description",
			content:
				"Run LLMs locally with an Ollama-style CLI and an OpenAI-compatible API — powered by llama.cpp, built with Deno, and released into the public domain.",
		},
	];
}

const tabClass =
	"border-[3px] border-ink border-b-0 px-4 py-2 font-mono text-sm font-bold uppercase tracking-wide data-selected:bg-ink data-selected:text-paper data-hovered:bg-lime data-selected:data-hovered:bg-ink data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-blue";

const features = [
	{
		title: "openai-compatible api",
		body: "freellama serve speaks the OpenAI API on localhost:11434 — point any client or SDK at it.",
	},
	{
		title: "ollama-style cli",
		body: "pull, run, list, rm, serve. If you know Ollama, you already know freellama.",
	},
	{
		title: "straight from hugging face",
		body: "Models are plain GGUF files pulled directly from Hugging Face. No registry, no account.",
	},
	{
		title: "public domain",
		body: "Released under the Unlicense. No telemetry, no tracking, no strings.",
	},
];

export default function Home() {
	return (
		<div className="mx-auto max-w-4xl px-4">
			{/* hero */}
			<section className="py-16 sm:py-20">
				<h1 className="font-mono text-5xl font-black tracking-tight sm:text-7xl">
					freellama<span className="text-accent">_</span>
				</h1>
				<p className="mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
					Run LLMs locally with an Ollama-style CLI and an OpenAI-compatible
					API — powered by{" "}
					<span className="bg-lime px-1 font-bold">llama.cpp</span>, built with{" "}
					<span className="bg-lime px-1 font-bold">Deno</span>, and released
					into the <span className="bg-lime px-1 font-bold">public domain</span>.
				</p>
				<div className="mt-8 flex flex-wrap gap-4">
					<Button
						as={RouterLink}
						to="/docs"
						className="border-[3px] border-ink bg-accent px-5 py-2.5 font-mono text-sm font-bold uppercase tracking-wide text-paper shadow-brutal data-hovered:bg-blue data-pressed:translate-x-[5px] data-pressed:translate-y-[5px] data-pressed:shadow-none data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-blue"
					>
						Read the docs
					</Button>
					<Button
						as="a"
						href="https://github.com/johnpangalos/freellama"
						className="border-[3px] border-ink bg-paper px-5 py-2.5 font-mono text-sm font-bold uppercase tracking-wide shadow-brutal data-hovered:bg-lime data-pressed:translate-x-[5px] data-pressed:translate-y-[5px] data-pressed:shadow-none data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-blue"
					>
						GitHub
					</Button>
				</div>
			</section>

			{/* install */}
			<section aria-label="Install">
				<h2 className="mb-4 font-mono text-2xl font-black uppercase tracking-tight">
					Install
				</h2>
				<Tabs defaultValue="script">
					<TabList className="flex" aria-label="Install methods">
						<Tab tab="script" className={tabClass}>
							install script
						</Tab>
						<Tab tab="source" className={tabClass}>
							from source
						</Tab>
					</TabList>
					<TabPanel tab="script">
						<CodeBlock code="curl -fsSL https://raw.githubusercontent.com/johnpangalos/freellama/main/install.sh | sh" />
					</TabPanel>
					<TabPanel tab="source">
						<CodeBlock
							code={`git clone https://github.com/johnpangalos/freellama\ncd freellama\ndeno task install`}
						/>
					</TabPanel>
				</Tabs>
			</section>

			{/* features */}
			<section className="py-16" aria-label="Features">
				<div className="grid gap-6 sm:grid-cols-2">
					{features.map((feature) => (
						<div
							key={feature.title}
							className="border-[3px] border-ink bg-paper p-5 shadow-brutal"
						>
							<h3 className="font-mono text-base font-black uppercase tracking-tight">
								{feature.title}
							</h3>
							<p className="mt-2 leading-relaxed">{feature.body}</p>
						</div>
					))}
				</div>
			</section>

			{/* quickstart */}
			<section aria-label="Quick start">
				<h2 className="mb-4 font-mono text-2xl font-black uppercase tracking-tight">
					Quick start
				</h2>
				<CodeBlock
					code={`# download a small model (~400 MB) from Hugging Face\nfreellama pull hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M\n\n# chat with it\nfreellama run hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M`}
				/>
			</section>
		</div>
	);
}
