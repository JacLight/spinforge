/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { SidebarLayout } from "@/components/sidebar-layout";
import { getModules } from "@/data/lessons";
import type React from "react";

export default function CourseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SidebarLayout modules={getModules()}>{children}</SidebarLayout>;
}
