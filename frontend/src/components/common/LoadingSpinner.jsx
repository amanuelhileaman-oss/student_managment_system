import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ message = 'Loading...', size = 'md' }) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400">
      <Loader2 className={`${sizeMap[size] || sizeMap.md} animate-spin text-primary-500`} />
      {message && <p className="mt-3 text-sm font-medium">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;
