import { Button, Tab, TabList, TabPanel, Tabs } from "@comp0/react";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router";

import type { Route } from "./+types/home";
import { CodeBlock } from "../components/CodeBlock.tsx";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "freellama — run LLMs locally" },
    {
      name: "description",
      content:
        "Run LLMs locally with a simple CLI and an OpenAI-compatible API — all the power of llama.cpp with none of the setup.",
    },
  ];
}

function FeatureCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-[3px] border-ink bg-paper p-5 shadow-brutal">
      <h3 className="font-mono text-base font-black tracking-tight uppercase">
        {title}
      </h3>
      <p className="mt-2 leading-relaxed">{children}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-4xl px-4">
      {/* hero */}
      <section
        className="
          py-16
          sm:py-20
        "
      >
        <h1
          className="
            font-mono text-5xl font-black tracking-tight
            sm:text-7xl
          "
        >
          freellama<span className="text-accent">_</span>
        </h1>
        <p
          className="
            mt-6 max-w-2xl text-lg leading-relaxed
            sm:text-xl
          "
        >
          All the power of{" "}
          <span className="bg-lime px-1 font-bold">llama.cpp</span> with none of
          the setup — a simple CLI and an OpenAI-compatible API, built with{" "}
          <span className="bg-lime px-1 font-bold">Deno</span> and released into
          the <span className="bg-lime px-1 font-bold">public domain</span>.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Button
            as={RouterLink}
            to="/docs"
            className="
              border-[3px] border-ink bg-accent px-5 py-2.5 font-mono text-sm
              font-bold tracking-wide text-paper uppercase shadow-brutal
              data-focus-visible:outline-2 data-focus-visible:outline-offset-2
              data-focus-visible:outline-blue
              data-hovered:bg-blue
              data-pressed:translate-x-[5px] data-pressed:translate-y-[5px]
              data-pressed:shadow-none
            "
          >
            Read the docs
          </Button>
          <Button
            as="a"
            href="https://github.com/johnpangalos/freellama"
            className="
              border-[3px] border-ink bg-paper px-5 py-2.5 font-mono text-sm
              font-bold tracking-wide uppercase shadow-brutal
              data-focus-visible:outline-2 data-focus-visible:outline-offset-2
              data-focus-visible:outline-blue
              data-hovered:bg-lime
              data-pressed:translate-x-[5px] data-pressed:translate-y-[5px]
              data-pressed:shadow-none
            "
          >
            GitHub
          </Button>
        </div>
      </section>

      {/* install */}
      <section aria-label="Install">
        <h2
          className="
            mb-4 font-mono text-2xl font-black tracking-tight uppercase
          "
        >
          Install
        </h2>
        <Tabs defaultValue="script">
          <TabList className="flex" aria-label="Install methods">
            <Tab
              tab="script"
              className="
                border-[3px] border-b-0 border-ink px-4 py-2 font-mono text-sm
                font-bold tracking-wide uppercase
                data-focus-visible:outline-2 data-focus-visible:outline-offset-2
                data-focus-visible:outline-blue
                data-hovered:bg-lime
                data-selected:bg-ink data-selected:text-paper
                data-selected:data-hovered:bg-ink
              "
            >
              install script
            </Tab>
            <Tab
              tab="source"
              className="
                border-[3px] border-b-0 border-ink px-4 py-2 font-mono text-sm
                font-bold tracking-wide uppercase
                data-focus-visible:outline-2 data-focus-visible:outline-offset-2
                data-focus-visible:outline-blue
                data-hovered:bg-lime
                data-selected:bg-ink data-selected:text-paper
                data-selected:data-hovered:bg-ink
              "
            >
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
        <div
          className="
            grid gap-6
            sm:grid-cols-2
          "
        >
          <FeatureCard title="openai-compatible api">
            freellama serve speaks the OpenAI API on localhost:11434 — point any
            client or SDK at it.
          </FeatureCard>
          <FeatureCard title="llama.cpp made easy">
            The official prebuilt llama-server, downloaded and managed for you.
            No toolchain, no build flags — just pull, run, serve.
          </FeatureCard>
          <FeatureCard title="straight from hugging face">
            Models are plain GGUF files pulled directly from Hugging Face. No
            registry, no account.
          </FeatureCard>
          <FeatureCard title="public domain">
            Released under the Unlicense. No telemetry, no tracking, no strings.
          </FeatureCard>
        </div>
      </section>

      {/* quickstart */}
      <section aria-label="Quick start">
        <h2
          className="
            mb-4 font-mono text-2xl font-black tracking-tight uppercase
          "
        >
          Quick start
        </h2>
        <CodeBlock
          code={`# download a small model (~400 MB) from Hugging Face\nfreellama pull hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M\n\n# chat with it\nfreellama run hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M`}
        />
      </section>
    </div>
  );
}
