/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { useSiteStore } from '@/store/site-store';

export const dockWindow = (windowId: string, position: 'left' | 'right' | 'top' | 'bottom' = 'right') => {
  useSiteStore.setState(prevState => ({
    dockedWindows: {
      ...prevState.dockedWindows,
      [windowId]: { id: windowId, position },
    },
  }));
};
export const undockWindow = (windowId: string) => {
  useSiteStore.setState(prevState => {
    delete prevState.dockedWindows[windowId];
    return { dockedWindows: { ...prevState.dockedWindows } };
  });
};

export const toggleDockedWindow = (windowId: string) => {
  const existingWindow = useSiteStore.getState().dockedWindows[windowId];
  if (existingWindow) {
    undockWindow(windowId);
  } else {
    dockWindow(windowId);
  }
};
export const minimizeWindow = (windowId: string) => {
  useSiteStore.setState(prevState => ({
    minimizedWindows: {
      ...prevState.minimizedWindows,
      [windowId]: { id: windowId, position: 'minimized' },
    },
  }));
};
export const restoreWindow = (windowId: string) => {
  useSiteStore.setState(prevState => {
    delete prevState.minimizedWindows[windowId];
    return { minimizedWindows: prevState.minimizedWindows };
  });
};

export function getElementWithMaxZIndex() {
  let maxZ = -Infinity;
  let maxEl = null;
  const allElements = document.getElementsByTagName('*');
  for (let el of allElements) {
    const z = window.getComputedStyle(el).zIndex;
    const zIndex = parseInt(z, 10);

    if (!isNaN(zIndex) && zIndex > maxZ) {
      maxZ = zIndex;
      maxEl = el;
    }
  }
  return { element: maxEl, zIndex: maxZ };
}
