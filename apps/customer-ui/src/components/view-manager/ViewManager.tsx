/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState, useEffect, useRef } from "react";
import { IconRenderer } from "../icons/icon-renderer";
import { shallow, useShallow } from "zustand/shallow";
import { useSiteStore } from "../../store/site-store";
import { createPortal } from "react-dom";
import { classNames } from "../../utils/helpers";
import { ViewManagerProps, Position, Size, WindowState } from "./types";

const calculatePosition = (
  position: Position,
  size: Size
): { x: number; y: number } => {
  const { x, y } = position;

  let calcX: number;
  let calcY: number;

  if (x === "center") {
    calcX = (window.innerWidth - size.width) / 2;
  } else if (x === "right") {
    calcX = window.innerWidth - size.width;
  } else if (x === "left") {
    calcX = 0;
  } else {
    calcX = x;
  }

  if (y === "center") {
    calcY = (window.innerHeight - size.height) / 2;
  } else if (y === "bottom") {
    calcY = window.innerHeight - size.height;
  } else if (y === "top") {
    calcY = 0;
  } else {
    calcY = y;
  }

  return { x: calcX, y: calcY };
};

const constrainToViewport = (
  pos: { x: number; y: number },
  boxSize: Size
): { x: number; y: number } => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const titleBarHeight = 40;

  return {
    x: Math.min(Math.max(0, pos.x), viewportWidth - boxSize.width),
    y: Math.min(Math.max(0, pos.y), viewportHeight - titleBarHeight),
  };
};

export const ViewManager: React.FC<ViewManagerProps> = ({
  id,
  children,
  title = "",
  defaultPosition = { x: "center", y: "center" },
  defaultSize = { width: 800, height: 600 },
  onClose = () => {},
  isResizable = true,
  compact = false,
  isModal = false,
  canDock = true,
  canMaximize = true,
  docked = false,
  closeOnOutsideClick = false,
  usePortal = false,
  savePosition = true,
  overflow = "",
  zIndex = 1000,
}) => {
  function getStoredValue<T>(key: string, defaultValue: T): T {
    if (!id || isModal || !savePosition) return defaultValue;
    const stored = localStorage.getItem(`float-box-${id}-${key}`);
    return stored ? JSON.parse(stored) : defaultValue;
  }

  const initialPosition = getStoredValue("position", defaultPosition);
  const initialSize = getStoredValue("size", defaultSize);
  const effectiveSize =
    id && localStorage.getItem(`float-box-${id}-size`)
      ? initialSize
      : defaultSize;
  const calculatedPosition = calculatePosition(initialPosition, effectiveSize);
  const constrainedPosition = constrainToViewport(
    calculatedPosition,
    effectiveSize
  );

  const [position, setPosition] = useState(constrainedPosition);
  const [size, setSize] = useState(effectiveSize);
  const [dockedHeight, setDockedHeight] = useState(
    getStoredValue("dockedHeight", 600)
  );
  const [windowState, setWindowState] = useState<WindowState>(
    getStoredValue("windowState", docked ? "docked" : "normal")
  );
  const [stateHistory, setStateHistory] = useState({
    normal: {
      position: calculatePosition(defaultPosition, defaultSize),
      size: defaultSize,
    },
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  );

  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { setStateItem, getStateItem } = useSiteStore.getState();
  const refDocument = window.parent?.document || document;

  // Portal container setup
  useEffect(() => {
    if (usePortal && typeof document !== "undefined") {
      let container = refDocument.getElementById(
        "view-manager-portal-container"
      );
      if (!container) {
        container = refDocument.createElement("div");
        container.id = "view-manager-portal-container";
        container.style.position = "fixed";
        container.style.top = "0";
        container.style.left = "0";
        container.style.width = "100%";
        container.style.height = "100%";
        container.style.pointerEvents = "none";
        container.style.zIndex = "1000";
        refDocument.body.appendChild(container);
      }
      setPortalContainer(container);
      return () => {
        if (container && container.childElementCount <= 1) {
          refDocument.body.removeChild(container);
        }
      };
    }
  }, [usePortal, refDocument]);

  // Window management
  useEffect(() => {
    if (id) {
      const thisWindow = {
        id,
        title,
        content: null,
        onRestore: restoreToNormal,
        onClose,
      };
      const minimizedWindows = (getStateItem("minimizedWindows") || []).filter(
        (win: any) => win.id !== id
      );
      const dockedWindows = (getStateItem("dockedWindows") || []).filter(
        (win: any) => win.id !== id
      );

      if (windowState === "minimized") {
        minimizedWindows.push(thisWindow);
      } else if (windowState === "docked") {
        dockedWindows.push(thisWindow);
      }
      setStateItem({ minimizedWindows, dockedWindows });

      return () => {
        setStateItem({
          minimizedWindows: (getStateItem("minimizedWindows") || []).filter(
            (win: any) => win.id !== id
          ),
          dockedWindows: (getStateItem("dockedWindows") || []).filter(
            (win: any) => win.id !== id
          ),
        });
      };
    }
  }, [windowState, id, title, onClose]);

  const restoreToNormal = () => {
    const normalState = stateHistory.normal;
    setPosition(normalState.position);
    setSize(normalState.size);

    if (windowState === "minimized") {
      const savedState = getStoredValue<WindowState>("windowState", "normal");
      setWindowState(
        savedState === "normal" || savedState === "docked"
          ? savedState
          : "normal"
      );
    } else {
      setWindowState("normal");
    }
    setIsMenuOpen(false);
  };

  const toggleMinimize = () => {
    if (windowState === "docked") {
      setWindowState("docked-minimized");
    } else if (windowState === "docked-minimized") {
      setWindowState("docked");
    } else if (windowState !== "minimized") {
      setWindowState("minimized");
    } else {
      restoreToNormal();
    }
    setIsMenuOpen(false);
  };

  const toggleMaximize = () => {
    if (windowState !== "maximized") {
      setWindowState("maximized");
    } else {
      const savedState = getStoredValue<WindowState>("windowState", "normal");
      const normalState = stateHistory.normal;
      setPosition(normalState.position);
      setSize(normalState.size);
      setWindowState(
        savedState === "normal" || savedState === "docked"
          ? savedState
          : "normal"
      );
    }
    setIsMenuOpen(false);
  };

  const toggleDock = () => {
    if (windowState !== "docked") {
      setWindowState("docked");
    } else {
      const normalState = stateHistory.normal;
      setPosition(normalState.position);
      setSize(normalState.size);
      setWindowState("normal");
    }
    setIsMenuOpen(false);
  };

  const getBoxStyle = (): React.CSSProperties => {
    const ensureValidNumber = (value: any, fallback: number = 0): number => {
      const num = typeof value === "number" ? value : parseFloat(value);
      return isNaN(num) || !isFinite(num) ? fallback : num;
    };

    const safePosition = {
      x: ensureValidNumber(position?.x, 100),
      y: ensureValidNumber(position?.y, 100),
    };
    const safeSize = {
      width: ensureValidNumber(size?.width, 800),
      height: ensureValidNumber(size?.height, 600),
    };

    if (isModal) {
      const viewportWidth = window.innerWidth || 1200;
      const viewportHeight = window.innerHeight || 800;
      const modalTop = Math.max(0, (viewportHeight - safeSize.height) / 2);
      const modalLeft = Math.max(0, (viewportWidth - safeSize.width) / 2);

      return {
        position: "fixed",
        top: `${modalTop}px`,
        left: `${modalLeft}px`,
        width: `${safeSize.width}px`,
        height: `${safeSize.height}px`,
        zIndex: zIndex + 100,
      };
    }

    switch (windowState) {
      case "minimized":
        return {
          position: "absolute",
          top: "0px",
          left: `${safePosition.x}px`,
          width: "300px",
          height: "30px",
          zIndex: zIndex,
        };
      case "maximized":
        return {
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: zIndex,
        };
      case "docked":
        return {
          position: "relative",
          width: "100%",
          minHeight: "400px",
          height: `${ensureValidNumber(dockedHeight, 600)}px`,
          marginBottom: "8px",
          zIndex: zIndex,
          flexShrink: 0,
          resize: "vertical",
          overflow: "hidden",
        };
      case "docked-minimized":
        return {
          position: "relative",
          width: "100%",
          height: "40px",
          marginBottom: "8px",
          zIndex: zIndex,
        };
      default:
        return {
          position: "fixed",
          top: `${safePosition.y}px`,
          left: `${safePosition.x}px`,
          width: `${safeSize.width}px`,
          height: `${safeSize.height}px`,
          zIndex: zIndex,
        };
    }
  };

  if (windowState === "minimized") {
    return null;
  }

  const content = (
    <div style={{ pointerEvents: usePortal ? "auto" : "inherit" }}>
      {isModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          style={{ zIndex: 1050 }}
        />
      )}
      <div
        ref={boxRef}
        style={getBoxStyle()}
        className={classNames(
          "rounded-lg bg-white/95 shadow-lg flex flex-col overflow-hidden",
          isModal ? "shadow-xl" : "",
          overflow
        )}
      >
        <div
          ref={dragRef}
          className={`bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-between ${
            isModal ? "" : "cursor-move"
          } select-none h-10 px-3`}
        >
          <span className="text-sm text-white font-medium truncate">
            {title}
          </span>
          <div className="flex items-center space-x-1">
            {!isModal && (
              <>
                <button
                  onClick={toggleMinimize}
                  className="p-1 hover:bg-white/20 rounded text-white transition-colors"
                >
                  <IconRenderer icon="Minus" size={16} />
                </button>
                {canMaximize && (
                  <button
                    onClick={toggleMaximize}
                    className="p-1 hover:bg-white/20 rounded text-white transition-colors"
                  >
                    <IconRenderer
                      icon={
                        windowState === "maximized" ? "Minimize2" : "Maximize2"
                      }
                      size={16}
                    />
                  </button>
                )}
              </>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-white/20 rounded text-white transition-colors"
              >
                <IconRenderer icon="X" size={16} />
              </button>
            )}
          </div>
        </div>

        {windowState !== "docked-minimized" && (
          <div
            className={classNames(
              "flex-1 overflow-auto relative bg-white",
              compact ? "pt-2" : "",
              overflow
            )}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );

  if (windowState === "docked" || windowState === "docked-minimized") {
    const dockedContainer = document.getElementById("docked-windows-container");
    if (dockedContainer) {
      return createPortal(content, dockedContainer);
    }
    return null;
  }

  if (usePortal && portalContainer && typeof refDocument !== "undefined") {
    return createPortal(content, portalContainer);
  }

  return content;
};

export default ViewManager;
