"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TOCItem {
  id: string;
  title: string;
  level: number;
}

interface TableOfContentsProps {
  className?: string;
}

export function TableOfContents({ className }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const elements = document.querySelectorAll("h2, h3");
    const items: TOCItem[] = [];
    
    elements.forEach((element) => {
      const id = element.id || element.textContent?.toLowerCase().replace(/\s+/g, "-") || "";
      if (!element.id) {
        element.id = id;
      }
      
      items.push({
        id,
        title: element.textContent || "",
        level: parseInt(element.tagName[1]),
      });
    });
    
    setHeadings(items);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-100px 0px -66%",
        threshold: 0,
      }
    );

    const elements = document.querySelectorAll("h2, h3");
    elements.forEach((element) => observer.observe(element));

    return () => {
      elements.forEach((element) => observer.unobserve(element));
    };
  }, [headings]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const y = element.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className={cn("sticky top-24", className)}>
      <h4 className="text-sm font-semibold text-gray-900 mb-3">On this page</h4>
      <ul className="space-y-2 text-sm">
        {headings.map((heading) => (
          <li
            key={heading.id}
            className={cn(
              heading.level === 3 && "ml-4"
            )}
          >
            <button
              onClick={() => scrollToHeading(heading.id)}
              className={cn(
                "text-left w-full hover:text-indigo-600 transition-colors py-1",
                activeId === heading.id
                  ? "text-indigo-600 font-medium"
                  : "text-gray-600"
              )}
            >
              {heading.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}