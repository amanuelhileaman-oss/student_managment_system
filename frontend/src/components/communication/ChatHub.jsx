import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  MessageSquare,
  Send,
  User,
  Users,
  GraduationCap,
  Layers,
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

  // Group chat creation, modal demands and sections
  const [modalTab, setModalTab] = useState('section'); // 'section' | 'grade' | 'teachers' | 'all_students' | 'direct'
  const [sectionGradeFilter, setSectionGradeFilter] = useState('ALL');
  const [sectionsList, setSectionsList] = useState([]);
  const [selectedGroupGrade, setSelectedGroupGrade] = useState(9);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Conversation deletion state
  const [deleteConvModalOpen, setDeleteConvModalOpen] = useState(false);
  const [deletingConv, setDeletingConv] = useState(false);

  // Search in existing conversations
  const [searchConv, setSearchConv] = useState('');

  const messagesEndRef = useRef(null);
  const messageContainerRef = useRef(null);
  const activeConvRef = useRef(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Synchronize ref with state to prevent stale closure bugs
  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const showToast = (msg) => {
    setInfoToast(msg);
    setTimeout(() => setInfoToast(''), 3000);
  };

  const selectConversation = (conv) => {
    if (!conv) {
      activeConvRef.current = null;
      setActiveConv(null);
      setMessages([]);
      return;
    }
    activeConvRef.current = conv;
    setActiveConv(conv);
    setMessages([]);
    setNewMsg('');
    fetchMessages(conv.id);
  };

  const fetchConversations = async (silent = false, targetConv = null) => {
    if (!silent) setIsRefreshingConv(true);
    try {
      const res = await api.get('/communications/conversations');
      const convList = res.data.data || [];
      setConversations(convList);

      const target = targetConv || activeConvRef.current;
      if (target?.id) {
        const found = convList.find((c) => c.id === target.id);
        if (found) {
          const merged = { ...target, ...found };
          activeConvRef.current = merged;
          setActiveConv(merged);
        } else if (targetConv) {
          activeConvRef.current = targetConv;
          setActiveConv(targetConv);
        }
      } else if (!silent && convList.length > 0) {
        selectConversation(convList[0]);
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
      const curr = activeConvRef.current;
      if (curr?.id) {
        fetchMessages(curr.id, false);
      }
      showToast('Chat data synchronized');
    };

    window.addEventListener('stude:refresh', handleGlobalRefresh);
    return () => window.removeEventListener('stude:refresh', handleGlobalRefresh);
  }, []);

  // Poll conversations every 6 seconds
  useEffect(() => {
    const convInterval = setInterval(() => {
      fetchConversations(true);
    }, 6000);
    return () => clearInterval(convInterval);
  }, []);

  // Fetch messages when active conversation changes & poll every 3 seconds for responsive chat
  useEffect(() => {
    if (activeConv?.id) {
      fetchMessages(activeConv.id, true);
      const msgInterval = setInterval(() => {
        fetchMessages(activeConv.id, true);
      }, 3000);
      return () => clearInterval(msgInterval);
    }
  }, [activeConv?.id]);

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

  const fetchSections = async () => {
    try {
      const res = await api.get('/academic/sections');
      const list = res.data.data || [];
      setSectionsList(list);
      if (list.length > 0 && !selectedSectionId) {
        setSelectedSectionId(list[0].id);
      }
    } catch (e) {
      console.warn('Failed to fetch sections:', e);
    }
  };

  const handleOpenContacts = () => {
    setShowContactsModal(true);
    fetchContacts();
    fetchSections();
  };

  const handleStartGroup = async ({ groupType, targetGradeLevel, targetSectionId, customTitle }) => {
    setCreatingGroup(true);
    try {
      const res = await api.post('/communications/conversations/group', {
        groupType,
        targetGradeLevel,
        targetSectionId,
        customTitle,
      });
      setShowContactsModal(false);
      const conv = res.data.data;
      selectConversation(conv);
      await fetchConversations(true, conv);
      showToast(`Group channel "${conv.title}" active`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to open group chat.');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleDeleteConversation = async () => {
    const curr = activeConvRef.current || activeConv;
    if (!curr) return;
    setDeletingConv(true);
    try {
      await api.delete(`/communications/conversations/${curr.id}`);
      showToast(curr.is_group ? 'Group chat deleted successfully.' : 'Conversation deleted successfully.');
      setDeleteConvModalOpen(false);
      selectConversation(null);
      await fetchConversations(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete conversation.');
    } finally {
      setDeletingConv(false);
    }
  };

  const handleStartWithContact = async (contact) => {
    try {
      const res = await api.post('/communications/conversations/start', {
        recipientId: contact.id,
      });
      setShowContactsModal(false);
      const conv = res.data.data;
      selectConversation(conv);
      await fetchConversations(true, conv);
      showToast(`Direct message with ${contact.first_name} ${contact.last_name} active`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start conversation.');
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const currentConv = activeConvRef.current || activeConv;
    if (!newMsg.trim() || !currentConv?.id || sending) return;

    const contentToSend = newMsg.trim();
    setNewMsg('');
    setSending(true);

    try {
      await api.post('/communications/messages', {
        conversationId: currentConv.id,
        content: contentToSend,
      });
      await fetchMessages(currentConv.id, true);
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
    const title = (c.title || '').toLowerCase();
    const q = searchConv.toLowerCase();
    return name.includes(q) || email.includes(q) || role.includes(q) || title.includes(q);
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
                    onClick={() => selectConversation(c)}
                    className={`w-full p-3.5 text-left flex items-start gap-3 transition-colors ${
                      isSelected
                        ? 'bg-primary-50/80 dark:bg-primary-950/40 border-l-4 border-primary-600'
                        : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {c.is_group ? (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                        {c.group_type === 'TEACHERS' ? (
                          <GraduationCap className="w-5 h-5" />
                        ) : c.group_type === 'SECTION' ? (
                          <Layers className="w-5 h-5" />
                        ) : (
                          <Users className="w-5 h-5" />
                        )}
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 shrink-0">
                        {c.first_name?.[0] || 'U'}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                          {c.is_group ? c.title : `${c.first_name} ${c.last_name}`}
                        </span>
                        {c.is_group ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800 shrink-0">
                            {c.group_type === 'TEACHERS'
                              ? 'Faculty'
                              : c.group_type === 'SECTION'
                              ? `Sec ${c.section_name || ''}`
                              : c.group_type === 'GRADE'
                              ? `Grade ${c.target_grade_level}`
                              : 'Group'}
                          </span>
                        ) : (
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border inline-flex items-center gap-0.5 shrink-0 ${badgeInfo.style}`}
                          >
                            <RoleIcon className="w-2.5 h-2.5" />
                            <span>{badgeInfo.label}</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {c.is_group ? (
                          c.group_type === 'GRADE'
                            ? `Official channel for all Grade ${c.target_grade_level} students`
                            : c.group_type === 'SECTION'
                            ? `Class Section ${c.section_name || ''} channel`
                            : c.group_type === 'TEACHERS'
                            ? 'Official faculty staff channel'
                            : 'Official school-wide channel'
                        ) : (
                          `Direct conversation with ${c.first_name || 'contact'}`
                        )}
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
                {activeConv.is_group ? (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                    {activeConv.group_type === 'TEACHERS' ? (
                      <GraduationCap className="w-5 h-5" />
                    ) : activeConv.group_type === 'SECTION' ? (
                      <Layers className="w-5 h-5" />
                    ) : (
                      <Users className="w-5 h-5" />
                    )}
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                    {activeConv.first_name?.[0] || 'U'}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {activeConv.is_group ? activeConv.title : `${activeConv.first_name} ${activeConv.last_name}`}
                    </h3>
                    {activeConv.is_group ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                        {activeConv.group_type === 'TEACHERS'
                          ? 'Faculty Group'
                          : activeConv.group_type === 'SECTION'
                          ? 'Section Channel'
                          : activeConv.group_type === 'GRADE'
                          ? `Grade ${activeConv.target_grade_level} Channel`
                          : 'School Channel'}
                      </span>
                    ) : (
                      (() => {
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
                      })()
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {activeConv.is_group
                      ? activeConv.group_type === 'TEACHERS'
                        ? 'Official faculty discussion channel'
                        : activeConv.group_type === 'GRADE'
                        ? `Official channel for all Grade ${activeConv.target_grade_level} students`
                        : activeConv.group_type === 'SECTION'
                        ? `Class section channel • ${activeConv.section_name || ''}`
                        : 'Official school-wide channel'
                      : activeConv.email}
                  </span>
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

                {/* Delete conversation / group (Admin or participant) */}
                {(user?.role === 'admin' || user?.role === 'superadmin' || !activeConv.is_group) && (
                  <button
                    type="button"
                    onClick={() => setDeleteConvModalOpen(true)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title={activeConv.is_group ? 'Delete group conversation' : 'Delete conversation'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
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
                      : activeConv.is_group
                      ? `Welcome to ${activeConv.title}`
                      : `Direct conversation with ${activeConv.first_name || 'contact'}`}
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
                placeholder={`Message ${activeConv?.is_group ? activeConv.title : (activeConv?.first_name || 'contact')}... (Press Enter to send)`}
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
              Select an ongoing conversation from the list or click New Chat to start a message with students, faculty, or administration.
            </p>
          </div>
        )}
      </div>

      {/* Start New Conversation • Demand Selector Modal */}
      {showContactsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Start New Conversation</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-950/70 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
                      Demand Selector
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Select your communication demand: Class Section, Grade Level, Teachers, All Students, or Direct User
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowContactsModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Demand Category Switcher Bar */}
            <div className="p-3 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 px-1">
                Choose Communication Demand:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {/* 1. Class Section */}
                <button
                  type="button"
                  onClick={() => setModalTab('section')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    modalTab === 'section'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/30 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-amber-600 dark:text-amber-400">
                    <Layers className="w-4 h-4 shrink-0" />
                    <span className="font-bold text-xs">Class Section</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                    Grade &amp; Section groups
                  </span>
                </button>

                {/* 2. Grade Level */}
                <button
                  type="button"
                  onClick={() => setModalTab('grade')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    modalTab === 'grade'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/30 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-400/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-emerald-600 dark:text-emerald-400">
                    <BookOpen className="w-4 h-4 shrink-0" />
                    <span className="font-bold text-xs">Grade Level</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                    Grades 9, 10, 11, 12
                  </span>
                </button>

                {/* 3. Faculty Teachers */}
                <button
                  type="button"
                  onClick={() => setModalTab('teachers')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    modalTab === 'teachers'
                      ? 'bg-purple-500/10 border-purple-500 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/30 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-purple-400/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-purple-600 dark:text-purple-400">
                    <GraduationCap className="w-4 h-4 shrink-0" />
                    <span className="font-bold text-xs">Faculty Staff</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                    All Teachers Group
                  </span>
                </button>

                {/* 4. All Students */}
                <button
                  type="button"
                  onClick={() => setModalTab('all_students')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    modalTab === 'all_students'
                      ? 'bg-blue-500/10 border-blue-500 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/30 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-blue-600 dark:text-blue-400">
                    <Users className="w-4 h-4 shrink-0" />
                    <span className="font-bold text-xs">All Students</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                    School-wide Chat
                  </span>
                </button>

                {/* 5. Single User (1-on-1) */}
                <button
                  type="button"
                  onClick={() => setModalTab('direct')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between col-span-2 sm:col-span-1 ${
                    modalTab === 'direct'
                      ? 'bg-primary-500/10 border-primary-500 text-primary-900 dark:text-primary-200 ring-2 ring-primary-500/30 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-primary-400/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-primary-600 dark:text-primary-400">
                    <User className="w-4 h-4 shrink-0" />
                    <span className="font-bold text-xs">Single User</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                    1-on-1 Direct Chat
                  </span>
                </button>
              </div>
            </div>

            {/* Modal Body / Active Demand Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Demand 1: Class Section */}
              {modalTab === 'section' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>Chat by Class Section</span>
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Select any section to start or open its official group channel.
                      </p>
                    </div>

                    {/* Grade Level Filter Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {['ALL', '9', '10', '11', '12'].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setSectionGradeFilter(g)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            sectionGradeFilter === g
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {g === 'ALL' ? 'All' : `G-${g}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sections List Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {sectionsList
                      .filter((sec) => sectionGradeFilter === 'ALL' || sec.grade_level === parseInt(sectionGradeFilter, 10))
                      .map((sec) => (
                        <div
                          key={sec.id}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-amber-500/70 hover:shadow-md transition-all flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
                              {sec.section_name}
                            </div>
                            <div className="min-w-0">
                              <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                                Grade {sec.grade_level} - Sec {sec.section_name}
                              </h5>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {sec.stream_code || sec.stream_name || 'General Stream'}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={creatingGroup}
                            onClick={() =>
                              handleStartGroup({
                                groupType: 'SECTION',
                                targetSectionId: sec.id,
                                targetGradeLevel: sec.grade_level,
                                customTitle: `Grade ${sec.grade_level} - Section ${sec.section_name} Group`,
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs shadow-xs flex items-center gap-1 transition-all disabled:opacity-50 shrink-0"
                          >
                            <span>Open</span>
                            <span>→</span>
                          </button>
                        </div>
                      ))}

                    {sectionsList.length === 0 && (
                      <div className="col-span-2 p-8 text-center text-slate-400 text-xs">
                        No sections configured in academic records.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Demand 2: Grade Level */}
              {modalTab === 'grade' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Chat by Grade Level (Targeted Channel)</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Open an interactive group channel for an entire grade level across all sections.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {[9, 10, 11, 12].map((lvl) => (
                      <div
                        key={lvl}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-emerald-500 hover:shadow-md transition-all flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-bold text-sm flex items-center justify-center shrink-0">
                            G-{lvl}
                          </div>
                          <div>
                            <h5 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                              Grade {lvl} - All Students Channel
                            </h5>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Targeted broadcast and interactive group discussion for all Grade {lvl} students.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={creatingGroup}
                          onClick={() =>
                            handleStartGroup({
                              groupType: 'GRADE',
                              targetGradeLevel: lvl,
                              customTitle: `Grade ${lvl} - All Students Group`,
                            })
                          }
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 shrink-0"
                        >
                          <span>Open Grade {lvl} Chat</span>
                          <span>→</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Demand 3: Faculty Teachers */}
              {modalTab === 'teachers' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/50 dark:bg-purple-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                          All Faculty Teachers Group
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          Official real-time group channel for all registered teachers and academic faculty.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={creatingGroup}
                      onClick={() => handleStartGroup({ groupType: 'TEACHERS', customTitle: 'Faculty Staff Group' })}
                      className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shrink-0"
                    >
                      <span>Open Faculty Group</span>
                      <span>→</span>
                    </button>
                  </div>

                  <div className="pt-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Or message an individual teacher directly:
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {contacts
                        .filter((c) => c.role === 'teacher')
                        .map((t) => (
                          <div
                            key={t.id}
                            onClick={() => handleStartWithContact(t)}
                            className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                                {t.first_name?.[0]}
                              </div>
                              <div>
                                <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                                  {t.first_name} {t.last_name}
                                </span>
                                <span className="text-[11px] text-slate-400 block">{t.specialization || t.email}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 text-xs font-bold border border-primary-200 dark:border-primary-800 hover:bg-primary-100"
                            >
                              Message
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Demand 4: All Students */}
              {modalTab === 'all_students' && (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                          All Students Group (School-wide)
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          Broadcast announcements and coordinate discussions with every student across all grades and sections.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={creatingGroup}
                      onClick={() => handleStartGroup({ groupType: 'ALL_STUDENTS', customTitle: 'All Students (School-wide)' })}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shrink-0"
                    >
                      <span>Open School-wide Chat</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Demand 5: Single User (1-on-1 Direct Chat) */}
              {modalTab === 'direct' && (
                <div className="space-y-3">
                  {/* Filter Tabs & Search */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        placeholder="Search contacts by name, email, or student ID..."
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
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto pr-1">
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
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 shrink-0">
                                {contact.first_name?.[0] || 'U'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                                    {contact.first_name} {contact.last_name}
                                  </span>
                                  <span
                                    className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border inline-flex items-center gap-0.5 shrink-0 ${badge.style}`}
                                  >
                                    <RoleIcon className="w-2.5 h-2.5" />
                                    <span>{badge.label}</span>
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 block truncate">{contact.email}</span>
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
                              className="px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 hover:bg-primary-100 font-bold text-xs border border-primary-200 dark:border-primary-800 transition-all shrink-0"
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Conversation / Group Confirmation Modal */}
      {deleteConvModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                  {activeConv?.is_group ? 'Delete Group Conversation?' : 'Delete Conversation?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeConv?.is_group
                    ? `This will permanently delete "${activeConv.title}" and all its message history for all members.`
                    : `This will permanently delete the conversation with ${activeConv?.first_name} ${activeConv?.last_name} and all its messages.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConvModalOpen(false)}
                disabled={deletingConv}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConversation}
                disabled={deletingConv}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                {deletingConv ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Delete {activeConv?.is_group ? 'Group' : 'Chat'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHub;
