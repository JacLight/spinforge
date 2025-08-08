import React, { lazy, Suspense, ComponentType } from 'react';

interface LoadableOptions {
  fallback?: React.ReactElement;
}

export function lazyLoad<T extends Record<string, any>>(
  importFunc: () => Promise<T>,
  selectorFunc?: (module: T) => ComponentType<any>,
  options: LoadableOptions = {}
) {
  const LazyComponent = lazy(() => 
    importFunc().then(module => ({
      default: selectorFunc ? selectorFunc(module) : module.default
    }))
  );

  const LoadableComponent = (props: any) => (
    <Suspense fallback={options.fallback || <div>Loading...</div>}>
      <LazyComponent {...props} />
    </Suspense>
  );

  return LoadableComponent;
}
