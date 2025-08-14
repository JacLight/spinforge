"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./CodeBlock";

interface CodeTab {
  label: string;
  value: string;
  code: string;
  language?: string;
  filename?: string;
  icon?: React.ReactNode;
}

interface CodeTabsProps {
  tabs: CodeTab[];
  defaultTab?: string;
  className?: string;
}

export function CodeTabs({ tabs, defaultTab, className }: CodeTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.value || "");
  
  const activeTabData = tabs.find(tab => tab.value === activeTab) || tabs[0];

  return (
    <div className={cn("rounded-lg overflow-hidden", className)}>
      <div className="flex border-b border-gray-200 bg-gray-50">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2",
              activeTab === tab.value
                ? "bg-white text-gray-900 border-b-2 border-indigo-600"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      
      {activeTabData && (
        <CodeBlock
          code={activeTabData.code}
          language={activeTabData.language}
          filename={activeTabData.filename}
        />
      )}
    </div>
  );
}