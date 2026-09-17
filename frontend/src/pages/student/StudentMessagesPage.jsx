import React, { useState } from 'react';
import ChatHub from '../../components/communication/ChatHub';
import { MessageSquare, RefreshCw } from 'lucide-react';

const StudentMessagesPage = () => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    window.dispatchEvent(new CustomEvent('stude:refresh'));
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-600" />
            <span>Student Messages & Academic Inquiries</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Reach out directly to your subject teachers and administrative admissions office.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 font-bold text-xs flex items-center gap-2 shadow-xs transition-all active:scale-95"
          title="Refresh messages and conversations"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh Chat</span>
        </button>
      </div>

      <ChatHub portalTitle="Student Direct Chat" />
    </div>
  );
};

export default StudentMessagesPage;
