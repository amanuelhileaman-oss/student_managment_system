import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  MessageSquare,
  Send,
  User,
  Search,
  Plus,
  X,
  Clock,
  Shield,
  BookOpen,
  Award,
  CheckCheck,
  Check,
  RefreshCw,
  Pencil,
  Trash2,
  Copy,
  ArrowDown,
} from 'lucide-react';

const ChatHub = ({ portalTitle = 'Communication & Direct Messages' }) => {
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [infoToast, setInfoToast] = useState('');

  // Refresh states
  const [isRefreshingConv, setIsRefreshingConv] = useState(false);
  const [isRefreshingMsg, setIsRefreshingMsg] = useState(false);

  // Message edit state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Message delete state
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Clipboard copy state
  const [copiedMsgId, setCopiedMsgId] = useState(null);

  // In-conversation message search state
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearchTerm, setMsgSearchTerm] = useState('');

  // Contacts directory modal state
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [contactRoleFilter, setContactRoleFilter] = useState('ALL');

  // Search in existing conversations
  const [searchConv, setSearchConv] = useState('');

  const messagesEndRef = useRef(null);
  const messageContainerRef = useRef(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const showToast = (msg) => {
    setInfoToast(msg);
    setTimeout(() => setInfoToast(''), 3000);
  };

  const fetchConversations = async (silent = false) => {
    if (!silent) setIsRefreshingConv(true);
    try {
      const res = await api.get('/communications/conversations');
      const convList = res.data.data || [];
      setConversations(convList);

      // Default select first conversation if none selected
      if (!silent && !activeConv && convList.length > 0) {
        setActiveConv(convList[0]);
      }
    } catch (err) {
      if (!silent) setError('Unable to load conversations.');
    } finally {
      if (!silent) {
        setLoading(false);
        setIsRefreshingConv(false);
      }
    }
  };

  const fetchMessages = async (convId, silent = false) => {
    if (!silent) setIsRefreshingMsg(true);
    try {
      const res = await api.get(`/communications/conversations/${convId}/messages`);
      setMessages(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      if (!silent) setIsRefreshingMsg(false);
    }
  };

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const res = await api.get('/communications/contacts');
      setContacts(res.data.data || []);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, []);

  // Listen to global app refresh event
  useEffect(() => {
    const handleGlobalRefresh = () => {
      fetchConversations(false);
      if (activeConv) {
        fetchMessages(activeConv.id, false);
      }
      showToast('Chat data synchronized');
    };

    window.addEventListener('stude:refresh', handleGlobalRefresh);
    return () => window.removeEventListener('stude:refresh', handleGlobalRefresh);
  }, [activeConv]);

  // Poll conversations every 6 seconds
  useEffect(() => {
    const convInterval = setInterval(() => {
      fetchConversations(true);
    }, 6000);
    return () => clearInterval(convInterval);
  }, []);

  // Fetch messages when active conversation changes & poll every 3 seconds for responsive chat
  useEffect(() => {
    if (activeConv) {
      fetchMessages(activeConv.id);
      const msgInterval = setInterval(() => {
        fetchMessages(activeConv.id, true);
      }, 3000);
      return () => clearInterval(msgInterval);
    }
  }, [activeConv]);

  // Auto scroll to bottom when messages update (unless user scrolled up)
  useEffect(() => {
    if (!showScrollDown) {
      scrollToBottom();
    }
  }, [messages]);

  // Track scroll position to show scroll down button
  const handleScroll = () => {
    if (!messageContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messageContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 100;
    setShowScrollDown(isUp);
  };

  const handleOpenContacts = () => {
    setShowContactsModal(true);
    fetchContacts();
  };

  const handleStartWithContact = async (contact) => {
    try {
      const res = await api.post('/communications/conversations/start', {
        recipientId: contact.id,
      });
      setShowContactsModal(false);
      const conv = res.data.data;
      setActiveConv(conv);
      await fetchConversations(true);
      showToast(`Direct message opened with ${contact.first_name}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start conversation.');
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newMsg.trim() || !activeConv || sending) return;

    const contentToSend = newMsg.trim();
    setNewMsg('');
    setSending(true);

    try {
      await api.post('/communications/messages', {
        conversationId: activeConv.id,
        content: contentToSend,
      });
      await fetchMessages(activeConv.id, true);
      await fetchConversations(true);
      scrollToBottom();
    } catch (err) {
      setError('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // --- Message Edit Handlers ---
  const handleStartEdit = (msg) => {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
    setDeletingMessageId(null);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async (messageId) => {
    if (!editingContent.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await api.put(`/communications/messages/${messageId}`, {
        content: editingContent.trim(),
      });
      const updatedMsg = res.data.data;
      // Update locally immediately
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, ...updatedMsg, is_edited: true } : m))
      );
      setEditingMessageId(null);
      setEditingContent('');
      showToast('Message edited');
      // Sync conversations to update preview
      fetchConversations(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to edit message.');
    } finally {
      setSavingEdit(false);
    }
  };

  // --- Message Delete Handlers ---
  const handlePromptDelete = (msgId) => {
    setDeletingMessageId(msgId);
    setEditingMessageId(null);
  };

  const handleCancelDelete = () => {
    setDeletingMessageId(null);
  };

  const handleConfirmDelete = async (messageId) => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await api.delete(`/communications/messages/${messageId}`);
      // Remove locally immediately
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setDeletingMessageId(null);
      showToast('Message deleted');
      // Sync conversations
      fetchConversations(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete message.');
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Message Copy Handler ---
  const handleCopyMessage = (msg) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(msg.content);
      setCopiedMsgId(msg.id);
      showToast('Message copied to clipboard');
      setTimeout(() => {
        setCopiedMsgId(null);
      }, 2000);
    }
  };

  const roleBadges = {
    admin: {
      label: 'Admin',
      style: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      icon: Shield,
    },
    teacher: {
      label: 'Teacher',
      style: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      icon: BookOpen,
    },
    student: {
      label: 'Student',
      style: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      icon: Award,
    },
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchConv.trim()) return true;
    const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
    const email = (c.email || '').toLowerCase();
    const role = (c.role || '').toLowerCase();
    const q = searchConv.toLowerCase();
    return name.includes(q) || email.includes(q) || role.includes(q);
  });

  const filteredContacts = contacts.filter((item) => {
    if (contactRoleFilter !== 'ALL' && item.role.toUpperCase() !== contactRoleFilter) {
      return false;
    }
    if (!contactSearch.trim()) return true;
    const q = contactSearch.toLowerCase();
    const name = `${item.first_name || ''} ${item.last_name || ''}`.toLowerCase();
    const email = (item.email || '').toLowerCase();
    const extra = (item.specialization || item.student_id || item.section_name || '').toLowerCase();
    return name.includes(q) || email.includes(q) || extra.includes(q);
  });

  const filteredMessages = messages.filter((m) => {
    if (!msgSearchTerm.trim()) return true;
    return m.content.toLowerCase().includes(msgSearchTerm.toLowerCase());
  });

  if (loading) {
    return <LoadingSpinner message="Connecting to secure communication hub..." />;
  }

  return (
    <div className="h-[calc(100vh-9.5rem)] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm relative">
      {/* Toast Notification */}
      {infoToast && (
        <div className="absolute top-3 right-4 z-40 px-3.5 py-1.5 rounded-xl bg-slate-900/90 dark:bg-slate-100/90 text-white dark:text-slate-900 text-xs font-medium shadow-lg backdrop-blur-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
          <span>{infoToast}</span>
        </div>
      )}

      {/* Top Banner / Error notice if any */}
      {error && (
        <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 font-bold">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Sidebar: Active Conversations List */}
        <div className="w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          {/* Header & New Chat button */}
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary-600" />
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Conversations ({conversations.length})
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fetchConversations(false)}
                disabled={isRefreshingConv}
                className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                title="Refresh conversations list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingConv ? 'animate-spin text-primary-600' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleOpenContacts}
                className="px-2.5 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-95 text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition-all"
                title="Start a new conversation"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Chat</span>
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="p-2.5 border-b border-slate-200 dark:border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchConv}
                onChange={(e) => setSearchConv(e.target.value)}
                placeholder="Filter messages..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Conversation List Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredConversations.length > 0 ? (
              filteredConversations.map((c) => {
                const isSelected = activeConv?.id === c.id;
                const badgeInfo = roleBadges[c.role] || roleBadges.student;
                const RoleIcon = badgeInfo.icon;
                const hasUnread = parseInt(c.unread_count, 10) > 0;

                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveConv(c)}
                    className={`w-full p-3.5 text-left flex items-start gap-3 transition-colors ${
                      isSelected
                        ? 'bg-primary-50/80 dark:bg-primary-950/40 border-l-4 border-primary-600'
                        : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 shrink-0">
                      {c.first_name?.[0] || 'U'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                          {c.first_name} {c.last_name}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border inline-flex items-center gap-0.5 shrink-0 ${badgeInfo.style}`}
                        >
                          <RoleIcon className="w-2.5 h-2.5" />
                          <span>{badgeInfo.label}</span>
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {c.last_message || 'Start conversation...'}
                      </p>

                      {hasUnread && (
                        <span className="inline-block mt-1 px-1.5 py-0.2 bg-primary-600 text-white rounded-full text-[9px] font-bold">
                          New
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                <p>No active conversations.</p>
                <button
                  type="button"
                  onClick={handleOpenContacts}
                  className="mt-3 inline-flex items-center gap-1 font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Start a new chat</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Area: Active Chat Window */}
        {activeConv ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
            {/* Chat Partner Header */}
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  {activeConv.first_name?.[0] || 'U'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {activeConv.first_name} {activeConv.last_name}
                    </h3>
                    {(() => {
                      const badge = roleBadges[activeConv.role] || roleBadges.student;
                      const RoleIcon = badge.icon;
                      return (
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border inline-flex items-center gap-0.5 ${badge.style}`}
                        >
                          <RoleIcon className="w-2.5 h-2.5" />
                          <span>{badge.label}</span>
                        </span>
                      );
                    })()}
                  </div>
                  <span className="text-[11px] text-slate-400">{activeConv.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Search inside conversation toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setShowMsgSearch(!showMsgSearch);
                    if (showMsgSearch) setMsgSearchTerm('');
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${
                    showMsgSearch
                      ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="Search in this conversation"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>

                {/* Refresh active chat messages */}
                <button
                  type="button"
                  onClick={() => fetchMessages(activeConv.id, false)}
                  disabled={isRefreshingMsg}
                  className="px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
                  title="Refresh chat messages"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingMsg ? 'animate-spin text-primary-600' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>

            {/* In-conversation Search Bar */}
            {showMsgSearch && (
              <div className="px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={msgSearchTerm}
                  onChange={(e) => setMsgSearchTerm(e.target.value)}
                  placeholder="Filter messages in this conversation..."
                  autoFocus
                  className="flex-1 text-xs bg-transparent border-none outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400"
                />
                {msgSearchTerm && (
                  <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                    {filteredMessages.length} match{filteredMessages.length === 1 ? '' : 'es'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMsgSearchTerm('');
                    setShowMsgSearch(false);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Message Feed */}
            <div
              ref={messageContainerRef}
              onScroll={handleScroll}
              className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/40 dark:bg-slate-950/40 relative"
            >
              {filteredMessages.length > 0 ? (
                filteredMessages.map((m) => {
                  const isMe = m.sender_id === user?.id;
                  const canEdit = isMe;
                  const canDelete = isMe || user?.role === 'admin';
                  const isEditing = editingMessageId === m.id;
                  const isConfirmingDelete = deletingMessageId === m.id;
                  const timeFormatted = m.created_at
                    ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      {/* Editing Mode */}
                      {isEditing ? (
                        <div className="w-full max-w-lg p-3 rounded-2xl bg-white dark:bg-slate-800 border-2 border-primary-500 shadow-md">
                          <div className="flex items-center justify-between mb-1.5 text-xs font-bold text-primary-600 dark:text-primary-400">
                            <span className="flex items-center gap-1.5">
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Edit Message</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              Press Enter to save • Esc to cancel
                            </span>
                          </div>
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveEdit(m.id);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                handleCancelEdit();
                              }
                            }}
                            rows={3}
                            autoFocus
                            className="w-full p-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500 text-slate-900 dark:text-slate-100 resize-none"
                          />
                          <div className="flex items-center justify-end gap-1.5 mt-2">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              disabled={savingEdit}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(m.id)}
                              disabled={savingEdit || !editingContent.trim()}
                              className="px-3 py-1 rounded-lg text-xs font-bold bg-primary-600 hover:bg-primary-700 active:scale-95 text-white flex items-center gap-1 shadow-sm transition-all disabled:opacity-50"
                            >
                              {savingEdit ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                              <span>Save changes</span>
                            </button>
                          </div>
                        </div>
                      ) : isConfirmingDelete ? (
                        /* Delete Confirmation Mode */
                        <div className="max-w-md p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 shadow-sm">
                          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-xs mb-1">
                            <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>Delete this message?</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2.5">
                            This message will be permanently deleted for all conversation participants.
                          </p>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={handleCancelDelete}
                              disabled={isDeleting}
                              className="px-2.5 py-1 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmDelete(m.id)}
                              disabled={isDeleting}
                              className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center gap-1 shadow-sm transition-all disabled:opacity-50"
                            >
                              {isDeleting ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                              <span>Delete Message</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Standard Message View with Hover Action Toolbar */
                        <div className="relative group/msg max-w-md">
                          {/* Floating Action Toolbar */}
                          <div
                            className={`absolute -top-3.5 ${
                              isMe ? 'right-2' : 'left-2'
                            } opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity duration-150 z-10 flex items-center gap-0.5 px-1.5 py-0.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xs border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm`}
                          >
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(m)}
                              title="Copy text"
                              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              {copiedMsgId === m.id ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>

                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleStartEdit(m)}
                                title="Edit message"
                                className="p-1 rounded text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}

                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handlePromptDelete(m.id)}
                                title="Delete message"
                                className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          <div
                            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                              isMe
                                ? 'bg-primary-600 text-white rounded-br-xs'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-xs'
                            }`}
                          >
                            {!isMe && (
                              <div className="text-[10px] font-bold text-primary-600 dark:text-primary-400 mb-1">
                                {m.first_name} ({m.role})
                              </div>
                            )}
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          </div>
                        </div>
                      )}

                      {/* Timestamp & Edited Indicator */}
                      <div className="text-[10px] text-slate-400 mt-1 px-1 flex items-center gap-1.5">
                        <span>{timeFormatted}</span>
                        {m.is_edited && (
                          <span
                            className="italic text-slate-400 dark:text-slate-500"
                            title={
                              m.updated_at
                                ? `Edited on ${new Date(m.updated_at).toLocaleTimeString()}`
                                : 'Edited'
                            }
                          >
                            (edited)
                          </span>
                        )}
                        {isMe && <CheckCheck className="w-3 h-3 text-primary-500" />}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs text-center p-6">
                  <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
                  <p className="font-semibold text-slate-600 dark:text-slate-300">
                    {msgSearchTerm
                      ? `No messages matched "${msgSearchTerm}"`
                      : `Direct conversation with ${activeConv.first_name}`}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {msgSearchTerm
                      ? 'Try searching with different keywords.'
                      : 'Send a message below to start collaborating in real-time.'}
                  </p>
                </div>
              )}
              <div ref={messagesEndRef} />

              {/* Jump to bottom button if scrolled up */}
              {showScrollDown && (
                <button
                  type="button"
                  onClick={() => scrollToBottom('smooth')}
                  className="fixed sm:absolute bottom-20 right-6 sm:right-6 p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-primary-600 dark:text-primary-400 shadow-lg hover:scale-105 active:scale-95 transition-all z-20"
                  title="Scroll to latest messages"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Chat Input */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2"
            >
              <textarea
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={`Message ${activeConv.first_name}... (Press Enter to send)`}
                className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100 resize-none max-h-24"
              />
              <button
                type="submit"
                disabled={!newMsg.trim() || sending}
                className="p-2.5 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white rounded-xl shadow-sm transition-all disabled:opacity-40 shrink-0"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <div className="w-14 h-14 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <MessageSquare className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">
              No Conversation Selected
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              Select an ongoing conversation from the list or start a new message with students, faculty, or administration.
            </p>
            <button
              type="button"
              onClick={handleOpenContacts}
              className="mt-4 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Start New Chat</span>
            </button>
          </div>
        )}
      </div>

      {/* New Conversation Contacts Modal */}
      {showContactsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  New Direct Message
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select a contact to start an official direct conversation
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowContactsModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Tabs & Search */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Search contacts by name, email, or subject..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500 text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Role filter tabs */}
              <div className="flex gap-1">
                {['ALL', 'TEACHER', 'STUDENT', 'ADMIN'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setContactRoleFilter(tab)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      contactRoleFilter === tab
                        ? 'bg-primary-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {tab === 'ALL' ? 'All Roles' : tab + 's'}
                  </button>
                ))}
              </div>
            </div>

            {/* Contacts Directory List */}
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800">
              {loadingContacts ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Loading available contacts...
                </div>
              ) : filteredContacts.length > 0 ? (
                filteredContacts.map((contact) => {
                  const badge = roleBadges[contact.role] || roleBadges.student;
                  const RoleIcon = badge.icon;

                  return (
                    <div
                      key={contact.id}
                      onClick={() => handleStartWithContact(contact)}
                      className="p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 shrink-0">
                          {contact.first_name?.[0] || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                              {contact.first_name} {contact.last_name}
                            </span>
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border inline-flex items-center gap-0.5 ${badge.style}`}
                            >
                              <RoleIcon className="w-2.5 h-2.5" />
                              <span>{badge.label}</span>
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 block">{contact.email}</span>
                          {contact.specialization && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Dept: {contact.specialization}
                            </span>
                          )}
                          {contact.student_id && (
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                              ID: {contact.student_id} {contact.section_name ? `• ${contact.section_name}` : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 hover:bg-primary-100 font-bold text-xs border border-primary-200 dark:border-primary-800 transition-all"
                      >
                        Message
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No contacts found matching your query.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHub;
