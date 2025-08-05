import React from 'react';

export const DockedContainer: React.FC = () => {
  return (
    <div 
      id="docked-windows-container" 
      className="fixed bottom-0 left-0 right-0 max-h-[50vh] overflow-y-auto bg-gray-50 border-t-2 border-gray-300 shadow-2xl z-40"
      style={{ display: 'flex', flexDirection: 'column' }}
    />
  );
};

export default DockedContainer;