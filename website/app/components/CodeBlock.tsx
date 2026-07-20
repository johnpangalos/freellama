import { useRef, useState } from "react";
import { Button } from "@comp0/react";

type CodeBlockProps = {
  code: string;
  label?: string;
  className?: string;
};

export function CodeBlock({
  code,
  label = "sh",
  className = "",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      className={`
        border-[3px] border-ink bg-code shadow-brutal
        ${className}
      `}
    >
      <div
        className="
          flex items-center justify-between border-b-[3px] border-ink bg-lime
          px-3 py-1.5
        "
      >
        <span className="font-mono text-xs font-bold tracking-widest uppercase">
          {label}
        </span>
        <Button
          onClick={copy}
          className="
            border-2 border-ink bg-paper px-2 py-0.5 font-mono text-xs font-bold
            uppercase shadow-brutal-sm transition-none
            data-focus-visible:outline-2 data-focus-visible:outline-offset-2
            data-focus-visible:outline-blue
            data-hovered:bg-accent data-hovered:text-paper
            data-pressed:translate-x-[3px] data-pressed:translate-y-[3px]
            data-pressed:shadow-none
          "
        >
          {copied ? "copied!" : "copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-sm leading-relaxed text-paper">
          {code}
        </code>
      </pre>
    </div>
  );
}
