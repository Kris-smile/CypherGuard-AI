import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

function CodeBlock({ className, children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'code';
  const code = String(children).replace(/\n$/, '');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (!className) {
    return (
      <code
        className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-blue-700"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="group relative my-4 overflow-hidden rounded-2xl border border-slate-200 bg-[#0f172a]">
      <div className="flex items-center justify-between border-b border-slate-700/70 bg-slate-900/80 px-4 py-2 text-xs text-slate-300">
        <span className="font-mono uppercase tracking-wide">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-slate-300 transition-colors hover:text-white"
          type="button"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-slate-100">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code: CodeBlock,
        p: ({ children }) => <p className="mb-3 leading-7 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
        li: ({ children }) => <li className="leading-7">{children}</li>,
        h1: ({ children }) => <h1 className="mb-3 mt-5 text-xl font-bold text-slate-900">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-bold text-slate-900">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold text-slate-900">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="my-4 border-l-4 border-blue-200 bg-blue-50/60 px-4 py-3 text-slate-700">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
        th: ({ children }) => <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">{children}</th>,
        td: ({ children }) => <td className="border-b border-slate-100 px-3 py-2 align-top">{children}</td>,
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 transition-colors hover:text-blue-700 hover:underline"
          >
            {children}
          </a>
        ),
        hr: () => <hr className="my-4 border-slate-200" />,
        strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
