import { useState, useEffect } from 'react';

interface ScreenSize {
  width: number;
  height: number;
  isTooSmall: boolean;
}

const useScreenSize = (minWidth = 0, minHeight = 0): ScreenSize => {
  const [screenSize, setScreenSize] = useState<ScreenSize>({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    isTooSmall: false,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setScreenSize({
        width,
        height,
        isTooSmall: width < minWidth || height < minHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    
    // Initial call to set the size
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [minWidth, minHeight]);

  return screenSize;
};

export default useScreenSize;