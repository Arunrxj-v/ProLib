import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * Markdown renderer for student write-ups.
 *
 * The seed content and every project section are authored in Markdown, so the
 * type scale, link colour and code treatment all come from the design system
 * instead of the browser defaults.
 */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("prolib-markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node: _node, ...props }) => (
            <h2
              className="mb-3 mt-8 text-lg font-semibold text-gh-fg-default first:mt-0"
              {...props}
            />
          ),
          h2: ({ node: _node, ...props }) => (
            <h3
              className="mb-3 mt-8 text-base font-semibold text-gh-fg-default first:mt-0"
              {...props}
            />
          ),
          h3: ({ node: _node, ...props }) => (
            <h4
              className="mb-2 mt-6 text-sm font-semibold text-gh-fg-default first:mt-0"
              {...props}
            />
          ),
          p: ({ node: _node, ...props }) => (
            <p className="mb-4 text-sm leading-7 text-gh-fg-muted last:mb-0" {...props} />
          ),
          a: ({ node: _node, ...props }) => (
            <a
              className="text-gh-accent underline underline-offset-2 hover:text-gh-fg-default"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          strong: ({ node: _node, ...props }) => (
            <strong className="font-semibold text-gh-fg-default" {...props} />
          ),
          em: ({ node: _node, ...props }) => <em {...props} />,
          ul: ({ node: _node, ...props }) => (
            <ul
              className="mb-4 list-disc space-y-1.5 pl-5 text-sm leading-7 text-gh-fg-muted marker:text-gh-accent"
              {...props}
            />
          ),
          ol: ({ node: _node, ...props }) => (
            <ol
              className="mb-4 list-decimal space-y-1.5 pl-5 text-sm leading-7 text-gh-fg-muted marker:text-gh-accent"
              {...props}
            />
          ),
          li: ({ node: _node, ...props }) => <li className="pl-1" {...props} />,
          blockquote: ({ node: _node, ...props }) => (
            <blockquote
              className="mb-4 border-l-2 border-gh-accent bg-gh-inset/60 py-2 pl-4 pr-3 text-sm leading-7 text-gh-fg-muted"
              {...props}
            />
          ),
          hr: () => <hr className="my-6 border-gh-border" />,
          code: ({ node: _node, className: inlineClass, ...props }) => {
            const isBlock = /language-/.test(inlineClass ?? "");
            if (isBlock) {
              return <code className={inlineClass} {...props} />;
            }
            return (
              <code
                className="rounded border border-gh-border bg-gh-inset px-1.5 py-0.5 font-mono text-[13px] text-gh-accent"
                {...props}
              />
            );
          },
          pre: ({ node: _node, children, ...props }) => (
            <pre
              className="mb-4 overflow-x-auto rounded-md border border-gh-border bg-gh-inset p-4 text-[13px] leading-6 text-gh-fg-muted"
              {...props}
            >
              {children}
            </pre>
          ),
          table: ({ node: _node, ...props }) => (
            <div className="mb-4 overflow-x-auto rounded-md border border-gh-border">
              <table className="w-full text-left text-sm" {...props} />
            </div>
          ),
          thead: ({ node: _node, ...props }) => (
            <thead className="bg-gh-subtle" {...props} />
          ),
          th: ({ node: _node, ...props }) => (
            <th
              className="border-b border-gh-border px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-gh-fg-muted"
              {...props}
            />
          ),
          td: ({ node: _node, ...props }) => (
            <td
              className="border-b border-gh-border-muted px-3 py-2 text-gh-fg-muted last:border-b-0"
              {...props}
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
