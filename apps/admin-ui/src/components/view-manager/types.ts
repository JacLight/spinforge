/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
export interface Position {
  x: number | 'center' | 'left' | 'right';
  y: number | 'center' | 'top' | 'bottom';
}

export interface Size {
  width: number;
  height: number;
}

export interface ViewManagerProps {
  id?: string;
  children: React.ReactNode;
  title?: string;
  defaultPosition?: Position;
  defaultSize?: Size;
  onClose?: () => void;
  isResizable?: boolean;
  compact?: boolean;
  isModal?: boolean;
  canDock?: boolean;
  canMaximize?: boolean;
  docked?: boolean;
  closeOnOutsideClick?: boolean;
  usePortal?: boolean;
  savePosition?: boolean;
  overflow?: string;
  zIndex?: number;
}

export type WindowState = 'normal' | 'minimized' | 'maximized' | 'docked' | 'docked-minimized';