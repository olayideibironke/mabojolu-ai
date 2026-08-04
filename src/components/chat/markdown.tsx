"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { CodeBlock } from "./code-block";

/**
 * Assistant Markdown renderer.
 *
 * react-markdown builds a React tree rather than injecting HTML, so raw HTML in
 * a model response is inert by default. This matters: assistant output can
 * contain text sourced from a user or a document, and `dangerouslySetInnerHTML`
 * would turn that into a script injection path. `rehype-raw` is deliberately
 * not used.
 *
 * Memoized because this re-renders on every streamed token, and re-parsing
 * unchanged Markdown is the main avoidable cost during streaming.
 */

const components: Components = {
  // Fenced blocks arrive as <pre><code>. Unwrap so CodeBlock owns the <pre>.
  pre({ children }) {
    return <>{children}</>;
  },

  code({ className, children, ...props }) {
    const language = /language-(\w+)/.exec(className ?? "")?.[1];

    // Inline code has no language class and is styled by globals.css.
    if (!language) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }

    return (
      <CodeBlock language={language} code={extractText(children)}>
        <code className={className} {...props}>
          {children}
        </code>
      </CodeBlock>
    );
  },

  // Tables get a scroll container so a wide table cannot widen the layout.
  table({ children }) {
    return (
      <div className="mabojolu-table-wrapper">
        <table>{children}</table>
      </div>
    );
  },

  a({ href, children, ...props }) {
    return (
      <a
        href={href}
        // Model output can link anywhere, so open externally and sever the
        // opener reference. `noreferrer` also blocks referrer leakage.
        target="_blank"
        rel="noopener noreferrer nofollow"
        {...props}
      >
        {children}
      </a>
    );
  },
};

const plugins = { remark: [remarkGfm], rehype: [rehypeHighlight] };

interface MarkdownProps {
  content: string;
}

function MarkdownImpl({ content }: MarkdownProps) {
  return (
    <div className="mabojolu-prose">
      <ReactMarkdown
        remarkPlugins={plugins.remark}
        rehypePlugins={plugins.rehype}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownImpl);

/**
 * Recover the plain source from a highlighted node tree.
 *
 * rehype-highlight replaces the code text with nested span elements, so the
 * original source has to be reassembled for the copy button to yield code the
 * user can actually run.
 */
function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }

  if (typeof node === "object" && "props" in node) {
    const element = node as { props?: { children?: React.ReactNode } };
    return extractText(element.props?.children);
  }

  return "";
}
