import React from 'react';
import { FolderOpen } from 'lucide-react';

const EmptyState = ({ title = 'No data available', description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
      <div className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl mb-4">
        <FolderOpen className="w-8 h-8" />
      </div>
      <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">{title}</h4>
      {description && <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
};

export default EmptyState;
