/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
declare module "node-webvtt" {
  interface Cue {
    text: string;
    start: number;
    end: number;
  }

  interface ParsedWebVTT {
    cues: Cue[];
  }

  export function parse(input: string): ParsedWebVTT;
}
