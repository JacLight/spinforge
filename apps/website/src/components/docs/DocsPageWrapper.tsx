"use client";

import { TableOfContents } from "./TableOfContents";

interface DocsPageWrapperProps {
  children: React.ReactNode;
}

export function DocsPageWrapper({ children }: DocsPageWrapperProps) {
  return (
    <div className="flex gap-8">
      <article className="flex-1 min-w-0 max-w-4xl">
        {children}
      </article>
      <aside className="hidden xl:block w-64 flex-shrink-0">
        <TableOfContents />
      </aside>
    </div>
  );
}