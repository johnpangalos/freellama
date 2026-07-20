import { BreadcrumbLink, Breadcrumbs, Separator } from "@comp0/react";
import type { ReactNode } from "react";

import type { Route } from "./+types/docs";
import { CodeBlock } from "../components/CodeBlock.tsx";
import { CommandSection } from "../components/CommandSection.tsx";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "CLI reference — freellama" },
    {
      name: "description",
      content:
        "Reference for the freellama CLI: pull, run, list, rm, serve, global flags, and environment variables.",
    },
  ];
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className="
        inline-block border-2 border-b-4 border-ink bg-paper px-1.5 py-0.5
        font-mono text-xs font-bold
      "
    >
      {children}
    </kbd>
  );
}

function Keys({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5">{children}</span>;
}

function Plus() {
  return <span aria-hidden="true">+</span>;
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="bg-lime px-1 font-mono text-sm font-bold">{children}</code>
  );
}

function DocsTable({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table
        aria-label={label}
        className="w-full border-[3px] border-ink shadow-brutal-sm"
      >
        {children}
      </table>
    </div>
  );
}

function HeadRow({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b-[3px] border-ink bg-ink text-left text-paper">
        {children}
      </tr>
    </thead>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th
      className="
        px-3 py-2 font-mono text-xs font-bold tracking-widest uppercase
      "
    >
      {children}
    </th>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <tr
      className="
        border-b-2 border-ink
        last:border-b-0
      "
    >
      {children}
    </tr>
  );
}

function Term({ children }: { children: ReactNode }) {
  return (
    <td
      className="
        px-3 py-2 align-top font-mono text-sm font-bold whitespace-nowrap
      "
    >
      {children}
    </td>
  );
}

function Desc({ children }: { children: ReactNode }) {
  return (
    <td className="px-3 py-2 align-top text-sm leading-relaxed">{children}</td>
  );
}

function SectionRule() {
  return <Separator className="block border-t-[3px] border-ink" />;
}

export default function Docs() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs
        aria-label="Breadcrumbs"
        className="
          flex items-center gap-2 font-mono text-xs tracking-widest uppercase
        "
      >
        <BreadcrumbLink
          href="/"
          className="
            underline decoration-2 underline-offset-4
            hover:bg-lime
          "
        >
          Home
        </BreadcrumbLink>
        <span aria-hidden="true" className="font-bold text-accent">
          /
        </span>
        <BreadcrumbLink current href="/docs" className="font-bold">
          Docs
        </BreadcrumbLink>
      </Breadcrumbs>

      <h1
        className="
          mt-6 font-mono text-4xl font-black tracking-tight uppercase
          sm:text-5xl
        "
      >
        CLI reference
      </h1>
      <p className="mt-4 max-w-prose text-lg leading-relaxed">
        Everything the <Code>freellama</Code> binary can do. Model references
        use the form <Code>hf:user/repo:QUANT</Code> or{" "}
        <Code>hf:user/repo/file.gguf</Code> and download straight from Hugging
        Face.
      </p>

      <div className="mt-8">
        <CodeBlock
          label="usage"
          code={`freellama <command> [args]

  pull <model>            Download a GGUF model from Hugging Face
  run <model> [prompt]    Chat with a model (REPL, or one-shot with a prompt)
  list | ls               List installed models
  rm <model>              Remove an installed model
  serve [--host H] [--port P]
                          Start an OpenAI-compatible server (default 127.0.0.1:11434)`}
        />
      </div>

      <div className="mt-8">
        <SectionRule />

        <CommandSection
          id="pull"
          title="freellama pull <model>"
          summary="Downloads a GGUF model from Hugging Face and stores it locally. Reference a quantization from a repo, or a specific .gguf file."
        >
          <div className="mt-4">
            <CodeBlock
              code={`# by quantization
freellama pull hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M

# by exact file
freellama pull hf:user/repo/file.gguf`}
            />
          </div>
          <p className="mt-4 max-w-prose text-sm leading-relaxed">
            Set <Code>HF_TOKEN</Code> to access gated model repos.
          </p>
        </CommandSection>

        <SectionRule />

        <CommandSection
          id="run"
          title="freellama run <model> [prompt]"
          summary="Starts an interactive streaming chat REPL, or runs a one-shot completion when you pass a prompt. Piping stdin also works: the reply is written to stdout with no prompts."
        >
          <div className="mt-4">
            <CodeBlock
              code={`# interactive REPL
freellama run hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M

# one-shot
freellama run hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M "Why is the sky blue?"

# piped stdin
echo "Why is the sky blue?" | freellama run hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M`}
            />
          </div>
          <DocsTable label="REPL commands">
            <HeadRow>
              <Th>In the REPL</Th>
              <Th>Effect</Th>
            </HeadRow>
            <tbody>
              <Row>
                <Term>/clear</Term>
                <Desc>Reset the conversation</Desc>
              </Row>
              <Row>
                <Term>
                  /bye or{" "}
                  <Keys>
                    <Kbd>Ctrl</Kbd>
                    <Plus />
                    <Kbd>D</Kbd>
                  </Keys>
                </Term>
                <Desc>Exit the REPL</Desc>
              </Row>
              <Row>
                <Term>
                  <Keys>
                    <Kbd>Ctrl</Kbd>
                    <Plus />
                    <Kbd>C</Kbd>
                  </Keys>
                </Term>
                <Desc>Interrupt a response without exiting</Desc>
              </Row>
            </tbody>
          </DocsTable>
        </CommandSection>

        <SectionRule />

        <CommandSection
          id="list"
          title="freellama list | ls"
          summary="Lists the models installed in your local store."
        />

        <SectionRule />

        <CommandSection
          id="rm"
          title="freellama rm <model>"
          summary="Removes an installed model from the local store."
        />

        <SectionRule />

        <CommandSection
          id="serve"
          title="freellama serve [--host H] [--port P]"
          summary="Starts an OpenAI-compatible HTTP server backed by llama.cpp. Models are loaded lazily and swapped on demand."
        >
          <DocsTable label="serve flags">
            <HeadRow>
              <Th>Flag</Th>
              <Th>Description</Th>
            </HeadRow>
            <tbody>
              <Row>
                <Term>--host H</Term>
                <Desc>Address to bind (default 127.0.0.1)</Desc>
              </Row>
              <Row>
                <Term>--port P</Term>
                <Desc>Port to listen on (default 11434)</Desc>
              </Row>
            </tbody>
          </DocsTable>
          <DocsTable label="HTTP endpoints">
            <HeadRow>
              <Th>Endpoint</Th>
              <Th>Description</Th>
            </HeadRow>
            <tbody>
              <Row>
                <Term>GET /health</Term>
                <Desc>Liveness check</Desc>
              </Row>
              <Row>
                <Term>GET /v1/models</Term>
                <Desc>List installed models (OpenAI format)</Desc>
              </Row>
              <Row>
                <Term>POST /v1/chat/completions</Term>
                <Desc>
                  Chat completions; supports <Code>"stream": true</Code>{" "}
                  (server-sent events)
                </Desc>
              </Row>
            </tbody>
          </DocsTable>
          <div className="mt-6">
            <CodeBlock
              code={`freellama serve
curl http://127.0.0.1:11434/v1/models`}
            />
          </div>
        </CommandSection>

        <SectionRule />

        <CommandSection
          id="global-flags"
          title="global flags"
          summary="Flags handled by the CLI itself, outside any command."
        >
          <DocsTable label="Global flags">
            <HeadRow>
              <Th>Flag</Th>
              <Th>Description</Th>
            </HeadRow>
            <tbody>
              <Row>
                <Term>--version, -v</Term>
                <Desc>Print the freellama version</Desc>
              </Row>
              <Row>
                <Term>help, --help, -h</Term>
                <Desc>Show usage help</Desc>
              </Row>
            </tbody>
          </DocsTable>
        </CommandSection>

        <SectionRule />

        <CommandSection
          id="environment"
          title="environment variables"
          summary="Configuration is environment-only — no config files."
        >
          <DocsTable label="Environment variables">
            <HeadRow>
              <Th>Variable</Th>
              <Th>Description</Th>
            </HeadRow>
            <tbody>
              <Row>
                <Term>FREELLAMA_HOME</Term>
                <Desc>Data directory (default ~/.freellama)</Desc>
              </Row>
              <Row>
                <Term>FREELLAMA_CTX</Term>
                <Desc>Context size passed to llama-server (default 4096)</Desc>
              </Row>
              <Row>
                <Term>FREELLAMA_LLAMA_VERSION</Term>
                <Desc>
                  Pin a llama.cpp release tag, e.g. <Code>b5900</Code> (default:
                  latest)
                </Desc>
              </Row>
              <Row>
                <Term>FREELLAMA_LLAMA_SERVER</Term>
                <Desc>
                  Path to an existing <Code>llama-server</Code> binary (skips
                  downloads)
                </Desc>
              </Row>
              <Row>
                <Term>FREELLAMA_SERVER_ARGS</Term>
                <Desc>
                  Extra flags passed through to <Code>llama-server</Code>
                </Desc>
              </Row>
              <Row>
                <Term>FREELLAMA_DEBUG=1</Term>
                <Desc>Show llama-server output for troubleshooting</Desc>
              </Row>
              <Row>
                <Term>HF_TOKEN</Term>
                <Desc>Hugging Face token for gated model repos</Desc>
              </Row>
            </tbody>
          </DocsTable>
        </CommandSection>
      </div>
    </div>
  );
}
