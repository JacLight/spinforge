"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  className?: string;
}

export function CodeBlock({ 
  code, 
  language = "bash", 
  filename,
  showLineNumbers = false,
  className 
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const lines = code.split('\n');

  return (
    <div className={cn("group relative rounded-lg overflow-hidden bg-gray-900", className)}>
      {filename && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <span className="text-xs text-gray-400 font-mono">{filename}</span>
          <span className="text-xs text-gray-500">{language}</span>
        </div>
      )}
      
      <div className="relative">
        <button
          onClick={copyToClipboard}
          className="absolute right-2 top-2 p-2 rounded-md bg-gray-800 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-700 hover:text-gray-300"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>

        <pre className={cn(
          "p-4 overflow-x-auto text-sm",
          showLineNumbers && "pl-12"
        )}>
          {showLineNumbers && (
            <div className="absolute left-0 top-0 pt-4 pl-3 select-none">
              {lines.map((_, i) => (
                <div key={i} className="text-gray-500 text-xs leading-6">
                  {i + 1}
                </div>
              ))}
            </div>
          )}
          <code className={cn(
            "text-gray-100 font-mono",
            `language-${language}`
          )}>
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
}