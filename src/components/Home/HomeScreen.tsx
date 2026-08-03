import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  ChevronRight,
  Plus,
  Search,
  FileText,
  Languages,
  TrendingUp,
  X,
  Users,
  Pin,
  FolderPlus,
  Folder,
  Check,
  Archive,
  Trash2,
  BellOff,
  FolderMinus,
  CheckCheck,
  ExternalLink,
  MousePointerClick,
  Edit2,
  Lock,
  Shield,
  EyeOff,
  FolderKanban,
  UserPlus,
} from 'lucide-react';
import { Contact, NewsItem, TabType, SystemAnnouncement, Story, User, ChatFolder } from '../../types';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import { ContactSyncModal } from '../Contacts/ContactSyncModal';
import { StoryViewer } from '../Feed/StoryViewer';
import { StoryCreatorModal } from '../Feed/StoryCreatorModal';
import { useLanguage } from '../../context/LanguageContext';


interface HomeScreenProps {
  contacts: Contact[];
  news: NewsItem[];
  setTab: (tab: TabType) => void;
  openChat: (contact: Contact) => void;
  onAskAI?: (prompt?: string, actionLabel?: string) => void;
  isDark?: boolean;
  onRefreshContacts?: () => void;
  currentUser?: User | null;
  onOpenUserProfile?: (userId: string) => void;
  onOpenAuth?: () => void;
}

const aiQuickActions = [
  { icon: Languages, label: 'Перевод текста', action: 'translate' },
  { icon: TrendingUp, label: 'Анализ портфеля', action: 'portfolio', disabled: true },
];

function useDraggableScroll() {
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  const ref = React.useCallback((element: HTMLDivElement | null) => {
    setNode(element);
  }, []);

  useEffect(() => {
    if (!node) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      startX = e.pageX - node.offsetLeft;
      scrollLeft = node.scrollLeft;
    };

    const onMouseLeave = () => {
      isDown = false;
    };

    const onMouseUp = () => {
      isDown = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - node.offsetLeft;
      const walk = (x - startX) * 1.5;
      node.scrollLeft = scrollLeft - walk;
    };

    node.addEventListener('mousedown', onMouseDown);
    node.addEventListener('mouseleave', onMouseLeave);
    node.addEventListener('mouseup', onMouseUp);
    node.addEventListener('mousemove', onMouseMove);

    return () => {
      node.removeEventListener('mousedown', onMouseDown);
      node.removeEventListener('mouseleave', onMouseLeave);
      node.removeEventListener('mouseup', onMouseUp);
      node.removeEventListener('mousemove', onMouseMove);
    };
  }, [node]);

  return ref;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  contacts,
  news,
  setTab,
  openChat,
  onAskAI,
  onRefreshContacts,
  currentUser,
  onOpenUserProfile,
  onOpenAuth,
}) => {
  const [feedCollapsed, setFeedCollapsed] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);

  // Folder Manager Modal State
  const [showFolderManagerModal, setShowFolderManagerModal] = useState(false);
  const [folderManagerMode, setFolderManagerMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingFolder, setEditingFolder] = useState<ChatFolder | null>(null);
  const [folderFormName, setFolderFormName] = useState('');
  const [folderFormContactIds, setFolderFormContactIds] = useState<string[]>([]);
  const [folderContactSearch, setFolderContactSearch] = useState('');

  // Stories State with instant localStorage cache
  const [stories, setStories] = useState<Story[]>(() => {
    try {
      const cached = localStorage.getItem('orbit_stories_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [showAddStoryModal, setShowAddStoryModal] = useState(false);
  const [storyImageUrl, setStoryImageUrl] = useState('');
  const [storyCaption, setStoryCaption] = useState('');

  // Channels & Groups State
  const [channelsGroups, setChannelsGroups] = useState<any[]>([]);
  const [showCreateCGModal, setShowCreateCGModal] = useState(false);
  const [cgType, setCgType] = useState<'public_channel' | 'private_channel' | 'public_group' | 'private_group' | 'closed_group'>('public_channel');
  const [cgTitle, setCgTitle] = useState('');
  const [cgHandle, setCgHandle] = useState('');
  const [cgDescription, setCgDescription] = useState('');

  const [isCreatingCG, setIsCreatingCG] = useState(false);

  const loadChannelsGroups = async () => {
    try {
      const list = await api.getChannelsGroups();
      if (Array.isArray(list)) {
        const unique = Array.from(new Map(list.map((item) => [item.id, item])).values());
        setChannelsGroups(unique);
      }
    } catch {}
  };

  const loadStories = async () => {
    try {
      const list = await api.getStories();
      if (Array.isArray(list)) {
        setStories(list);
        localStorage.setItem('orbit_stories_cache', JSON.stringify(list));
      }
    } catch {}
  };

  useEffect(() => {
    loadStories();
    loadChannelsGroups();

    const unsubNewStory = socketService.subscribe('new_story', (data) => {
      if (data.story) {
        setStories((prev) => {
          const exists = prev.some((s) => s.id === data.story.id);
          const next = exists ? prev.map((s) => (s.id === data.story.id ? data.story : s)) : [data.story, ...prev];
          localStorage.setItem('orbit_stories_cache', JSON.stringify(next));
          return next;
        });
      }
    });

    const unsubStoryUpdated = socketService.subscribe('story_updated', (data) => {
      if (data.story) {
        setStories((prev) => {
          const next = prev.map((s) => (s.id === data.story.id ? { ...s, ...data.story } : s));
          localStorage.setItem('orbit_stories_cache', JSON.stringify(next));
          return next;
        });
      }
    });

    const unsubStoryDeleted = socketService.subscribe('story_deleted', (data) => {
      if (data.storyId) {
        setStories((prev) => {
          const next = prev.filter((s) => s.id !== data.storyId);
          localStorage.setItem('orbit_stories_cache', JSON.stringify(next));
          return next;
        });
      }
    });

    return () => {
      unsubNewStory();
      unsubStoryUpdated();
      unsubStoryDeleted();
    };
  }, []);

  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('orbit_dismissed_announcements');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [categorizeToast, setCategorizeToast] = useState<string | null>(null);

  // Folder Categorization Mode
  const [folderMode, setFolderMode] = useState<'manual' | 'auto'>(() => {
    const key = currentUser ? `orbit_folder_mode_${currentUser.email}` : 'orbit_folder_mode_guest';
    return (localStorage.getItem(key) as 'manual' | 'auto') || 'manual';
  });

  const [showFolderModeModal, setShowFolderModeModal] = useState(false);

  // Hidden from "Все" contact IDs
  const [hiddenFromAllIds, setHiddenFromAllIds] = useState<string[]>(() => {
    const key = currentUser ? `orbit_hidden_from_all_${currentUser.email}` : 'orbit_hidden_from_all_guest';
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveHiddenFromAllIds = (ids: string[]) => {
    setHiddenFromAllIds(ids);
    const key = currentUser ? `orbit_hidden_from_all_${currentUser.email}` : 'orbit_hidden_from_all_guest';
    try {
      localStorage.setItem(key, JSON.stringify(ids));
    } catch {}
  };

  const handleSetFolderMode = (mode: 'manual' | 'auto') => {
    setFolderMode(mode);
    const key = currentUser ? `orbit_folder_mode_${currentUser.email}` : 'orbit_folder_mode_guest';
    localStorage.setItem(key, mode);
    setShowFolderModeModal(false);

    if (mode === 'auto') {
      handleAutoCategorize();
      setCategorizeToast('Режим: Автоматическое распределение');
    } else {
      setCategorizeToast('Режим: Ручное распределение');
    }
    setTimeout(() => setCategorizeToast(null), 2500);
  };

  // Folder & Pinning State
  const [folders, setFolders] = useState<ChatFolder[]>(() => {
    const storageKey = currentUser ? `orbit_chat_folders_${currentUser.email}` : 'orbit_chat_folders_guest';
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const storageKey = currentUser ? `orbit_chat_folders_${currentUser.email}` : 'orbit_chat_folders_guest';
    try {
      const saved = localStorage.getItem(storageKey);
      setFolders(saved ? JSON.parse(saved) : []);
    } catch {
      setFolders([]);
    }
    const modeKey = currentUser ? `orbit_folder_mode_${currentUser.email}` : 'orbit_folder_mode_guest';
    setFolderMode((localStorage.getItem(modeKey) as 'manual' | 'auto') || 'manual');
    const hiddenKey = currentUser ? `orbit_hidden_from_all_${currentUser.email}` : 'orbit_hidden_from_all_guest';
    try {
      const savedHidden = localStorage.getItem(hiddenKey);
      setHiddenFromAllIds(savedHidden ? JSON.parse(savedHidden) : []);
    } catch {
      setHiddenFromAllIds([]);
    }
  }, [currentUser?.email]);

  useEffect(() => {
    const allFolderContactIds = new Set(folders.flatMap((f) => f.contactIds));
    const nextHidden = hiddenFromAllIds.filter((id) => allFolderContactIds.has(id));
    if (nextHidden.length !== hiddenFromAllIds.length) {
      saveHiddenFromAllIds(nextHidden);
    }
  }, [folders]);

  const [pinnedContactIds, setPinnedContactIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('orbit_pinned_contacts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeFolderId, setActiveFolderId] = useState<string>('all');
  const [contextMenuContact, setContextMenuContact] = useState<Contact | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isPullSearchOpen, setIsPullSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  // Pull-down gesture state for dialogues list search
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const pullStartYRef = useRef<number | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  const handleContainerTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const container = chatContainerRef.current;
    if (!container || container.scrollTop > 5) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    pullStartYRef.current = clientY;
  };

  const handleContainerTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (pullStartYRef.current === null) return;
    const container = chatContainerRef.current;
    if (!container || container.scrollTop > 5) {
      pullStartYRef.current = null;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - pullStartYRef.current;
    if (deltaY > 0) {
      const dist = Math.min(70, Math.pow(deltaY, 0.85));
      setPullDistance(dist);
      setIsPulling(true);
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  const handleContainerTouchEnd = () => {
    if (pullDistance > 30) {
      setIsPullSearchOpen(true);
    }
    setPullDistance(0);
    setIsPulling(false);
    pullStartYRef.current = null;
  };

  // Long Press detection
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const list = await api.getActiveAnnouncements();
      setAnnouncements(list);
    } catch {
      // Ignore
    }
  };

  const handleDismissAnnouncement = (id: string) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      localStorage.setItem('orbit_dismissed_announcements', JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const aiScrollRef = useDraggableScroll();
  const feedScrollRef = useDraggableScroll();
  const folderScrollRef = useDraggableScroll();

  const handleAISubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const promptToSend = aiPrompt.trim();
    if (onAskAI) {
      onAskAI(promptToSend || undefined);
    } else {
      setTab('ai');
    }
    setAiPrompt('');
  };

  const saveFolders = (newFolders: ChatFolder[]) => {
    const nonFolderAll = newFolders.filter((f) => f.contactIds.length > 0);
    setFolders(nonFolderAll);
    const storageKey = currentUser ? `orbit_chat_folders_${currentUser.email}` : 'orbit_chat_folders_guest';
    try {
      localStorage.setItem(storageKey, JSON.stringify(nonFolderAll));
    } catch {
      // Ignore
    }
  };

  const handleAutoCategorize = () => {
    const allContacts = combinedContacts;
    if (allContacts.length === 0) {
      setCategorizeToast('Нет активных диалогов для группировки');
      setTimeout(() => setCategorizeToast(null), 2500);
      return;
    }

    const financeKeywords = [
      'wallet', 'кошелек', 'кошелёк', 'банк', 'bank', 'finance', 'финансы', 'crypto', 'крипта',
      'pay', 'оплата', 'rub', 'usd', 'eur', 'usdt', 'ton', 'btc', 'перевод', 'transfer', 'счет',
      'счёт', 'налог', 'bounty', 'trade', 'трейд', 'инвест', 'invest', 'акции', 'stock', 'обмен',
      'деньги', 'касса', 'cash', 'money', 'баллы', 'кошелёк'
    ];

    const workKeywords = [
      'work', 'работа', 'рабочи', 'project', 'проект', 'team', 'команда', 'boss', 'начальник',
      'dev', 'разраб', 'разработка', 'lead', 'офис', 'office', 'hr', 'отдел', 'company', 'компания',
      'support', 'поддержка', 'менеджер', 'manager', 'клиент', 'client', 'совещание', 'meeting',
      'задача', 'task', 'jira', 'doc', 'отчет', 'отчёт', 'biz', 'бизнес', 'партнер', 'коллега',
      'канал', 'channel', 'группа', 'group', 'сообщество', 'новости', 'news', 'b2b', 'it', 'дизайн'
    ];

    const financeIds: string[] = [];
    const workIds: string[] = [];
    const personalIds: string[] = [];

    allContacts.forEach((c) => {
      const textToMatch = `${c.name || ''} ${c.last || ''} ${c.handle || ''} ${c.description || ''} ${c.category || ''}`.toLowerCase();

      const isFinance = financeKeywords.some((kw) => textToMatch.includes(kw));
      if (isFinance) {
        financeIds.push(c.id);
        return;
      }

      const isWork = Boolean(c.isChannelGroup) || workKeywords.some((kw) => textToMatch.includes(kw));
      if (isWork) {
        workIds.push(c.id);
        return;
      }

      personalIds.push(c.id);
    });

    // Keep existing custom folders that are not Personal/Work/Finance
    const existingCustomFolders = folders.filter(
      (f) =>
        f.id !== 'folder_personal' &&
        f.id !== 'folder_work' &&
        f.id !== 'folder_finance' &&
        !['Personal', 'Work', 'Finance', 'Личные', 'Работа', 'Финансы'].includes(f.name)
    );

    const autoFolders: ChatFolder[] = [];
    if (personalIds.length > 0) {
      autoFolders.push({ id: 'folder_personal', name: 'Personal', contactIds: personalIds });
    }
    if (workIds.length > 0) {
      autoFolders.push({ id: 'folder_work', name: 'Work', contactIds: workIds });
    }
    if (financeIds.length > 0) {
      autoFolders.push({ id: 'folder_finance', name: 'Finance', contactIds: financeIds });
    }

    const updatedFolders = [...autoFolders, ...existingCustomFolders];
    saveFolders(updatedFolders);
    setActiveFolderId('all');

    setCategorizeToast(`Чаты распределены по категориям: Personal, Work, Finance`);
    setTimeout(() => setCategorizeToast(null), 3000);
  };

  const savePinnedContacts = (newPinned: string[]) => {
    setPinnedContactIds(newPinned);
    try {
      localStorage.setItem('orbit_pinned_contacts', JSON.stringify(newPinned));
    } catch {
      // Ignore
    }
  };

  const togglePinContact = (contactId: string) => {
    if (pinnedContactIds.includes(contactId)) {
      savePinnedContacts(pinnedContactIds.filter((id) => id !== contactId));
    } else {
      savePinnedContacts([...pinnedContactIds, contactId]);
    }
    setContextMenuContact(null);
  };

  const handleCreateFolderAndAdd = () => {
    const trimmed = newFolderName.trim().slice(0, 8);
    if (!trimmed) return;
    if (folders.length >= 10) {
      alert('Максимальное количество папок — 10');
      return;
    }
    if (!contextMenuContact) return;

    const newFolder: ChatFolder = {
      id: `folder_${Date.now()}`,
      name: trimmed,
      contactIds: [contextMenuContact.id],
    };

    saveFolders([...folders, newFolder]);
    setNewFolderName('');
    setShowFolderModal(false);
    setContextMenuContact(null);
  };

  const handleAddToExistingFolder = (folderId: string) => {
    if (!contextMenuContact) return;
    const updated = folders.map((f) => {
      if (f.id === folderId) {
        if (!f.contactIds.includes(contextMenuContact.id)) {
          return { ...f, contactIds: [...f.contactIds, contextMenuContact.id] };
        }
      }
      return f;
    });
    saveFolders(updated);
    setShowFolderModal(false);
    setContextMenuContact(null);
  };

  const handleRemoveFromFolder = (folderId: string, contactId: string) => {
    const updated = folders.map((f) => {
      if (f.id === folderId) {
        return { ...f, contactIds: f.contactIds.filter((id) => id !== contactId) };
      }
      return f;
    });
    saveFolders(updated);
    setContextMenuContact(null);
  };

  const openCreateFolderManager = () => {
    if (!currentUser) {
      onOpenAuth?.();
      return;
    }
    setEditingFolder(null);
    setFolderFormName('');
    setFolderFormContactIds([]);
    setFolderContactSearch('');
    setFolderManagerMode('create');
    setShowFolderManagerModal(true);
  };

  const openEditFolderManager = (folder: ChatFolder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUser) {
      onOpenAuth?.();
      return;
    }
    setEditingFolder(folder);
    setFolderFormName(folder.name);
    setFolderFormContactIds([...folder.contactIds]);
    setFolderContactSearch('');
    setFolderManagerMode('edit');
    setShowFolderManagerModal(true);
  };

  const handleSaveFolderManager = () => {
    const trimmed = folderFormName.trim().slice(0, 12);
    if (!trimmed) return;

    if (folderManagerMode === 'create') {
      if (folders.length >= 10) {
        alert('Максимальное количество папок — 10');
        return;
      }
      const newFolder: ChatFolder = {
        id: `folder_${Date.now()}`,
        name: trimmed,
        contactIds: folderFormContactIds,
      };
      saveFolders([...folders, newFolder]);
    } else if (folderManagerMode === 'edit' && editingFolder) {
      const updated = folders.map((f) =>
        f.id === editingFolder.id ? { ...f, name: trimmed, contactIds: folderFormContactIds } : f
      );
      saveFolders(updated);
    }

    setFolderManagerMode('list');
  };

  const handleDeleteFolder = (folderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = folders.filter((f) => f.id !== folderId);
    saveFolders(updated);
    if (activeFolderId === folderId) {
      setActiveFolderId('all');
    }
  };

  const toggleContactInFolderForm = (contactId: string) => {
    if (folderFormContactIds.includes(contactId)) {
      setFolderFormContactIds(folderFormContactIds.filter((id) => id !== contactId));
    } else {
      setFolderFormContactIds([...folderFormContactIds, contactId]);
    }
  };

  // Map Channel/Group items to Contact format
  const cgContacts: Contact[] = channelsGroups.map((cg) => ({
    id: cg.id,
    name: cg.title,
    initials: cg.title.substring(0, 2).toUpperCase(),
    color: cg.avatarColor || 'from-sky-400 to-indigo-500',
    avatarUrl: cg.avatarUrl,
    handle: cg.handle,
    last: cg.description || (cg.type.includes('channel') ? '📢 Канал' : '👥 Группа'),
    time: new Date(cg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    unread: 0,
    isChannelGroup: true,
    channelGroupType: cg.type,
    subscribersCount: cg.memberIds?.length || 1,
    membersCount: cg.memberIds?.length || 1,
    inviteLink: cg.inviteLink,
    isAdmin: cg.creatorId === currentUser?.id || (cg.adminIds || []).includes(currentUser?.id),
    description: cg.description,
  }));

  // Filter and sort contacts with deduplication (Empty if guest mode)
  const combinedContacts = currentUser ? [...contacts, ...cgContacts] : [];
  const uniqueContactsMap = new Map<string, Contact>();
  combinedContacts.forEach((c) => uniqueContactsMap.set(c.id, c));
  let displayedContacts = currentUser ? Array.from(uniqueContactsMap.values()) : [];

  if (currentUser && activeFolderId === 'all') {
    displayedContacts = displayedContacts.filter((c) => !hiddenFromAllIds.includes(c.id));
  } else if (currentUser && activeFolderId !== 'all') {
    const activeFolder = folders.find((f) => f.id === activeFolderId);
    if (activeFolder) {
      displayedContacts = displayedContacts.filter((c) => activeFolder.contactIds.includes(c.id));
    }
  }

  if (currentUser && chatSearchQuery.trim()) {
    const q = chatSearchQuery.toLowerCase().trim();
    displayedContacts = displayedContacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.last?.toLowerCase().includes(q)
    );
  }

  const sortedContacts = [...displayedContacts].sort((a, b) => {
    const aPinned = pinnedContactIds.includes(a.id) ? 1 : 0;
    const bPinned = pinnedContactIds.includes(b.id) ? 1 : 0;
    return bPinned - aPinned;
  });

  // Long touch handler
  const handleTouchStart = (c: Contact, e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    touchStartPosRef.current = { x: clientX, y: clientY };

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setContextMenuContact(c);
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!touchStartPosRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const dx = Math.abs(clientX - touchStartPosRef.current.x);
    const dy = Math.abs(clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  const { t } = useLanguage();

  return (
    <div className="px-5 pt-1 pb-4 h-full flex flex-col gap-2.5 relative">
      {/* AI Assistant card */}
      <div className="glass-card rounded-3xl p-4 shrink-0">
        <div
          onClick={() => (onAskAI ? onAskAI() : setTab('ai'))}
          className="flex items-center justify-between mb-2 cursor-pointer group"
        >
          <span className="text-sm font-semibold text-primary group-hover:text-blue-500 transition">
            {t.aiAssistant}
          </span>
        </div>

        <form
          onSubmit={handleAISubmit}
          className="w-full flex items-center gap-2 rounded-2xl glass-button px-3.5 py-2 mb-3 shadow-xs focus-within:border-blue-400 dark:focus-within:border-blue-500 transition"
        >
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Спросите Orbit о чем угодно…"
            className="flex-1 bg-transparent text-sm outline-none text-primary placeholder:text-muted px-1"
          />
          <button
            type="submit"
            className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center shrink-0 active:scale-95 transition shadow-sm"
            title="Отправить в ИИ ассистент"
          >
            <Sparkles size={14} className="text-white" />
          </button>
        </form>

        <div
          ref={aiScrollRef}
          className="flex gap-2 overflow-x-auto no-scrollbar touch-pan-x cursor-grab active:cursor-grabbing select-none py-0.5"
        >
          {aiQuickActions.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                if (a.disabled) {
                  if (onAskAI) onAskAI('', 'portfolio');
                  else setTab('ai');
                  return;
                }
                if (onAskAI) onAskAI('', a.action);
                else setTab('ai');
              }}
              className={`glass-button flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition ${
                a.disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
              }`}
            >
              <a.icon size={14} className={a.disabled ? 'text-slate-400' : 'text-blue-500'} />
              <span>{a.label}</span>
              {a.disabled && <span className="text-[10px] text-slate-400 ml-1">(недоступно)</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Admin System Announcements */}
      {announcements
        .filter((a) => !dismissedIds.includes(a.id))
        .map((ann) => {
          const handleAnnouncementAction = () => {
            if (ann.buttonUrl) {
              if (ann.buttonUrl.startsWith('http://') || ann.buttonUrl.startsWith('https://')) {
                window.open(ann.buttonUrl, '_blank');
              } else if (ann.buttonUrl.startsWith('/')) {
                window.location.href = ann.buttonUrl;
              } else {
                alert(`Действие новости: ${ann.buttonUrl}`);
              }
            }
          };

          const isClickableBlock = ann.isButton && !ann.buttonText;

          return (
            <div
              key={ann.id}
              onClick={isClickableBlock ? handleAnnouncementAction : undefined}
              className={`rounded-2xl px-3 py-2 shrink-0 relative border border-sky-400/50 dark:border-indigo-400/40 news-shimmer-bg shadow-md transition animate-fade-in ${
                isClickableBlock ? 'cursor-pointer hover:opacity-95 active:scale-[0.99]' : ''
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismissAnnouncement(ann.id);
                }}
                className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-black/20 dark:hover:bg-white/20 transition z-10"
                title="Скрыть новость"
              >
                <X size={12} />
              </button>

              {ann.title && ann.title.trim().length > 0 && (
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white pr-5 leading-tight mb-0.5 tracking-tight">
                  {ann.title}
                </h3>
              )}

              <div className="flex items-center justify-between gap-2 pr-5">
                <p className="text-xs text-slate-800 dark:text-slate-100 font-medium leading-snug whitespace-pre-wrap flex-1">
                  {ann.content}
                </p>
                {isClickableBlock && (
                  <ExternalLink size={13} className="text-sky-600 dark:text-sky-300 shrink-0" />
                )}
              </div>

              {ann.isButton && ann.buttonText && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAnnouncementAction();
                  }}
                  className="mt-1.5 w-full py-1 px-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 active:scale-98 transition"
                >
                  <span>{ann.buttonText}</span>
                  <ExternalLink size={12} />
                </button>
              )}
            </div>
          );
        })}

      {/* Dialogs / Chats section */}
      <div className="flex-1 min-h-0 flex flex-col relative">
        {/* Categorize Toast Notification */}
        {categorizeToast && (
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 text-xs font-semibold shadow-xl border border-white/20 dark:border-slate-800 animate-fade-in whitespace-nowrap">
            {categorizeToast}
          </div>
        )}

        {/* Folders Row with Categorize & Action Buttons (Only shown for logged-in users) */}
        {currentUser && (
          <div className="flex items-center justify-between gap-2 mb-2 shrink-0 relative">
            <div
              ref={folderScrollRef}
              className="flex-1 flex gap-1.5 overflow-x-auto no-scrollbar touch-pan-x cursor-grab active:cursor-grabbing select-none py-0.5 pr-2"
            >
              <button
                onClick={() => setActiveFolderId('all')}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setShowFolderModeModal(true);
                }}
                onTouchStart={(e) => {
                  const timer = setTimeout(() => setShowFolderModeModal(true), 500);
                  (e.currentTarget as any)._lpTimer = timer;
                }}
                onTouchEnd={(e) => {
                  if ((e.currentTarget as any)._lpTimer) clearTimeout((e.currentTarget as any)._lpTimer);
                }}
                onTouchMove={(e) => {
                  if ((e.currentTarget as any)._lpTimer) clearTimeout((e.currentTarget as any)._lpTimer);
                }}
                onMouseDown={(e) => {
                  const timer = setTimeout(() => setShowFolderModeModal(true), 500);
                  (e.currentTarget as any)._lpTimer = timer;
                }}
                onMouseUp={(e) => {
                  if ((e.currentTarget as any)._lpTimer) clearTimeout((e.currentTarget as any)._lpTimer);
                }}
                onMouseLeave={(e) => {
                  if ((e.currentTarget as any)._lpTimer) clearTimeout((e.currentTarget as any)._lpTimer);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition active:scale-95 shrink-0 flex items-center gap-1 ${
                  activeFolderId === 'all'
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    : 'glass-button text-slate-700 dark:text-slate-300'
                }`}
                title="Зажмите для выбора режима (Ручной / Авто)"
              >
                <span>Все</span>
              </button>
              {folders.map((f) => (
                <div key={f.id} className="shrink-0 flex items-center group">
                  <button
                    onClick={() => setActiveFolderId(f.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 ${
                      activeFolderId === f.id
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                        : 'glass-button text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Folder size={12} />
                    <span>{f.name}</span>
                    <span className="text-[10px] opacity-75">({f.contactIds.length})</span>
                    {activeFolderId === f.id && (
                      <span
                        onClick={(e) => openEditFolderManager(f, e)}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-white/20 transition cursor-pointer"
                        title="Настроить папку"
                      >
                        <Edit2 size={11} />
                      </span>
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Buttons inline on the right */}
            <div className="flex items-center gap-1.5 shrink-0 z-10">
              <button
                onClick={() => setShowSearchModal(true)}
                className="h-8 w-8 rounded-full bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center shrink-0 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition"
                title="Контакты, группы, каналы"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Contacts / Chat List Container with Drag Pull-Down Detection */}
        <div
          ref={chatContainerRef}
          onTouchStart={handleContainerTouchStart}
          onTouchMove={handleContainerTouchMove}
          onTouchEnd={handleContainerTouchEnd}
          onMouseDown={handleContainerTouchStart}
          onMouseMove={handleContainerTouchMove}
          onMouseUp={handleContainerTouchEnd}
          onMouseLeave={handleContainerTouchEnd}
          style={{
            transform: pullDistance > 0 ? `translateY(${pullDistance * 0.25}px)` : 'none',
            transition: isPulling ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
          className="glass-card rounded-3xl p-2 flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col relative select-none"
        >
          {/* Pull Indicator inside dialogue list container */}
          {pullDistance > 0 && (
            <div
              className="overflow-hidden transition-all flex items-center justify-center gap-2 text-xs font-semibold text-sky-500 py-1 mb-1 shrink-0 rounded-2xl bg-sky-500/10 border border-sky-500/20"
              style={{ height: `${pullDistance}px`, opacity: Math.min(1, pullDistance / 25) }}
            >
              <Search
                size={15}
                className={`transition-transform duration-200 ${
                  pullDistance > 30 ? 'scale-125 text-sky-600 dark:text-sky-400' : 'scale-90 text-slate-400'
                }`}
              />
              <span className="text-[11px]">
                {pullDistance > 30 ? 'Отпустите для вызова поиска' : 'Оттягивайте вниз для поиска...'}
              </span>
            </div>
          )}

          {/* Pull-Down Search Bar inside dialogue list container */}
          {isPullSearchOpen && (
            <div className="mb-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-sky-500/30 dark:border-sky-500/30 shadow-lg rounded-2xl px-3.5 py-2 text-xs flex items-center gap-2 animate-fade-in shrink-0">
              <Search size={15} className="text-sky-500 shrink-0" />
              <input
                type="text"
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                placeholder="Поиск по диалогам и сообщениям..."
                className="flex-1 bg-transparent border-none outline-none text-xs text-slate-800 dark:text-white placeholder:text-slate-400 font-medium"
                autoFocus
              />
              {chatSearchQuery ? (
                <button
                  onClick={() => setChatSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  title="Очистить"
                >
                  <X size={14} />
                </button>
              ) : (
                <button
                  onClick={() => setIsPullSearchOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition text-[11px] font-semibold text-sky-500"
                >
                  Закрыть
                </button>
              )}
            </div>
          )}

          {/* Pull handle / button */}
          <div
            onClick={() => setIsPullSearchOpen(!isPullSearchOpen)}
            className="w-full flex items-center justify-center py-1 mb-1 cursor-pointer hover:bg-slate-200/30 dark:hover:bg-slate-800/30 rounded-xl transition text-[10px] text-slate-400 font-medium gap-1.5 group"
            title="Потяните вниз или нажмите для поиска"
          >
            <div className="w-8 h-1 bg-slate-300 dark:bg-slate-700 rounded-full group-hover:bg-sky-500 transition" />
            {isPullSearchOpen && <span className="text-[10px] text-sky-500 font-semibold">Скрыть поиск</span>}
          </div>

          {!currentUser ? (
            <div className="text-center p-6 my-auto flex flex-col items-center justify-center gap-3 self-center w-full max-w-xs animate-fade-in">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Войдите в аккаунт для просмотра диалогов и общения
              </p>
              <button
                onClick={() => onOpenAuth?.()}
                className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/20 active:scale-95 transition"
              >
                Войти в аккаунт
              </button>
            </div>
          ) : sortedContacts.length === 0 ? (
            <div className="text-center text-xs text-muted p-6 my-auto flex flex-col items-center justify-center gap-2 self-center w-full">
              <Users size={32} className="text-slate-300 dark:text-slate-600 mb-1" />
              <span className="font-medium max-w-xs leading-relaxed text-secondary">
                {activeFolderId !== 'all'
                  ? 'В этой папке пока нет диалогов.'
                  : 'Нет активных чатов. Синхронизируйте контакты телефонной книги!'}
              </span>
            </div>
          ) : (
            sortedContacts.map((c, i) => {
              const isPinned = pinnedContactIds.includes(c.id);
              const contactStory = stories.find((s) => String(s.userId) === String(c.id));
              const hasUnviewedStory = contactStory && !contactStory.viewed;

              return (
                <div
                  key={c.id}
                  onTouchStart={(e) => handleTouchStart(c, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={(e) => handleTouchStart(c, e)}
                  onMouseUp={handleTouchEnd}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenuContact(c);
                  }}
                  onClick={() => openChat(c)}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-white/40 dark:hover:bg-slate-800/40 rounded-2xl transition cursor-pointer relative ${
                    i !== sortedContacts.length - 1 ? 'border-b border-custom' : ''
                  }`}
                >
                  <div
                    className="relative shrink-0"
                    onClick={(e) => {
                      if (hasUnviewedStory && contactStory) {
                        e.stopPropagation();
                        setActiveStory(contactStory);
                      }
                    }}
                  >
                    <div
                      className={`h-11 w-11 rounded-full p-[2px] ${
                        hasUnviewedStory ? 'animate-running-border shadow-md cursor-pointer' : ''
                      }`}
                    >
                      <div
                        className={`h-full w-full rounded-full bg-gradient-to-br ${c.color} flex items-center justify-center text-sm font-semibold text-white/90 shadow-sm overflow-hidden`}
                      >
                        {c.avatarUrl ? (
                          <img src={c.avatarUrl} alt={c.name} className="h-full w-full rounded-full object-cover" />
                        ) : (
                          c.initials
                        )}
                      </div>
                    </div>
                    {c.isOnline && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-sm font-semibold text-primary truncate">{c.name}</span>
                        {isPinned && <Pin size={12} className="text-sky-500 fill-sky-500 shrink-0" />}
                      </div>
                      <span className="text-[11px] text-muted shrink-0 ml-2">{c.time}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-secondary truncate pr-2">{c.last}</span>
                      {c.unread > 0 && (
                        <span className="h-5 min-w-5 px-1.5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Long-Press Glassmorphism Context Menu */}
      {contextMenuContact && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setContextMenuContact(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/60 dark:border-slate-800 shadow-2xl p-3 space-y-1 text-xs animate-scale-up"
          >
            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <div
                className={`h-8 w-8 rounded-full bg-gradient-to-br ${contextMenuContact.color} flex items-center justify-center text-white font-bold text-xs shrink-0`}
              >
                {contextMenuContact.initials}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-800 dark:text-white truncate">{contextMenuContact.name}</div>
                <div className="text-[10px] text-slate-400">Выберите действие</div>
              </div>
            </div>

            <button
              onClick={() => togglePinContact(contextMenuContact.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition"
            >
              <Pin size={15} className="text-sky-500" />
              <span>{pinnedContactIds.includes(contextMenuContact.id) ? 'Открепить диалог' : 'Закрепить диалог'}</span>
            </button>

            {onOpenUserProfile && (
              <button
                onClick={() => {
                  const targetId = contextMenuContact.id;
                  setContextMenuContact(null);
                  onOpenUserProfile(targetId);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition"
              >
                <Users size={15} className="text-indigo-500" />
                <span>Посмотреть профиль</span>
              </button>
            )}

            <button
              onClick={() => setShowFolderModal(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition"
            >
              <FolderPlus size={15} className="text-emerald-500" />
              <span>Управление папками</span>
            </button>

            {folders.some((f) => f.contactIds.includes(contextMenuContact.id)) && (
              <button
                onClick={() => {
                  const isHidden = hiddenFromAllIds.includes(contextMenuContact.id);
                  if (isHidden) {
                    saveHiddenFromAllIds(hiddenFromAllIds.filter((id) => id !== contextMenuContact.id));
                    setCategorizeToast('Диалог возвращен в папку «Все»');
                  } else {
                    saveHiddenFromAllIds([...hiddenFromAllIds, contextMenuContact.id]);
                    setCategorizeToast('Диалог скрыт из папки «Все»');
                  }
                  setTimeout(() => setCategorizeToast(null), 2500);
                  setContextMenuContact(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-sky-600 dark:text-sky-400 font-medium transition"
              >
                <EyeOff size={15} />
                <span>
                  {hiddenFromAllIds.includes(contextMenuContact.id)
                    ? 'Показывать в папке «Все»'
                    : 'Скрыть из папки «Все»'}
                </span>
              </button>
            )}

            <button
              onClick={() => {
                alert('Диалог отправлен в архив');
                setContextMenuContact(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition"
            >
              <Archive size={15} className="text-purple-500" />
              <span>В архив</span>
            </button>

            <button
              onClick={async () => {
                if (contextMenuContact) {
                  try {
                    await api.markMessagesRead(contextMenuContact.id);
                    onRefreshContacts();
                  } catch {}
                }
                setContextMenuContact(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition"
            >
              <CheckCheck size={15} className="text-blue-500" />
              <span>Пометить прочитанным</span>
            </button>

            <button
              onClick={async () => {
                if (contextMenuContact) {
                  const targetId = contextMenuContact.id;
                  const isCg = targetId.startsWith('cg_');
                  if (isCg) {
                    try {
                      await api.deleteChannelGroup(targetId);
                    } catch {
                      try {
                        await api.leaveChannelGroup(targetId);
                      } catch (err: any) {
                        alert(err.message || 'Ошибка при удалении');
                      }
                    }
                    loadChannelsGroups();
                  } else {
                    try {
                      await api.removeContact(targetId);
                    } catch (err: any) {
                      alert(err.message || 'Ошибка удаления чата');
                    }
                  }
                  const updatedFolders = folders.map((f) => ({
                    ...f,
                    contactIds: f.contactIds.filter((id) => id !== targetId),
                  }));
                  saveFolders(updatedFolders);
                  onRefreshContacts();
                }
                setContextMenuContact(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 font-medium transition"
            >
              <Trash2 size={15} />
              <span>{contextMenuContact?.id.startsWith('cg_') ? 'Удалить канал / группу' : 'Удалить чат'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Add To Folder Dialog Modal */}
      {showFolderModal && contextMenuContact && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowFolderModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 space-y-3 text-xs animate-scale-up"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-bold text-sm text-slate-800 dark:text-white">Добавить в папку</span>
              <button
                onClick={() => setShowFolderModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            {/* Existing Folders List */}
            {folders.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">Выберите папки для диалога:</span>
                {folders.map((f) => {
                  const isInFolder = f.contactIds.includes(contextMenuContact.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        if (isInFolder) {
                          handleRemoveFromFolder(f.id, contextMenuContact.id);
                        } else {
                          handleAddToExistingFolder(f.id);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition ${
                        isInFolder
                          ? 'bg-sky-500/10 border-sky-500/40 text-sky-900 dark:text-sky-100 font-bold'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-transparent hover:border-slate-300 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Folder size={14} className={isInFolder ? 'text-sky-500' : 'text-slate-400'} />
                        <span>{f.name}</span>
                      </div>
                      <div className={`h-4 w-4 rounded-md flex items-center justify-center border ${isInFolder ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                        {isInFolder && <Check size={10} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Create New Folder (Max 10, max 8 chars) */}
            {folders.length < 10 && (
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-semibold uppercase text-slate-400">Создать новую папку:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={8}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Имя (макс 8 симв)"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none text-slate-800 dark:text-white placeholder:text-slate-400"
                  />
                  <button
                    onClick={handleCreateFolderAndAdd}
                    disabled={!newFolderName.trim()}
                    className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-semibold transition shrink-0"
                  >
                    Создать
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Folder Categorization Mode Selection Modal */}
      {showFolderModeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowFolderModeModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 animate-scale-up"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="text-amber-500" size={18} />
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">Режим папок и категорий</h3>
              </div>
              <button
                onClick={() => setShowFolderModeModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div
                onClick={() => handleSetFolderMode('manual')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-start gap-3 ${
                  folderMode === 'manual'
                    ? 'bg-sky-500/10 border-sky-500 text-sky-900 dark:text-sky-100'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${folderMode === 'manual' ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-400'}`}>
                  {folderMode === 'manual' && <Check size={10} strokeWidth={3} />}
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-white mb-0.5">Распределять вручную (по умолчанию)</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Диалоги автоматически не распределяются. Вы сами зажимаете диалог и добавляете его в нужные категории.
                  </div>
                </div>
              </div>

              <div
                onClick={() => handleSetFolderMode('auto')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-start gap-3 ${
                  folderMode === 'auto'
                    ? 'bg-sky-500/10 border-sky-500 text-sky-900 dark:text-sky-100'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${folderMode === 'auto' ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-400'}`}>
                  {folderMode === 'auto' && <Check size={10} strokeWidth={3} />}
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-white mb-0.5">Распределять автоматически</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Диалоги автоматически распределяются по папкам Personal, Work, Finance на основе названия и контактов.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Story Modal */}
      <StoryCreatorModal
        isOpen={showAddStoryModal}
        onClose={() => setShowAddStoryModal(false)}
        currentUser={currentUser}
        onStoryCreated={(newStory) => {
          setStories((prev) => [newStory, ...prev]);
        }}
      />

      {/* Story Viewer Modal */}
      {activeStory && (
        <StoryViewer
          story={activeStory}
          currentUser={currentUser}
          onClose={() => setActiveStory(null)}
          onDeleteStory={(deletedId) => {
            setStories((prev) => prev.filter((s) => s.id !== deletedId));
          }}
          onUpdateStory={(updated) => {
            setStories((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          }}
        />
      )}

      {/* Create Channel or Group Modal */}
      {showCreateCGModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Users className="text-sky-500" size={18} />
                <span>Создать канал или группу</span>
              </h3>
              <button
                onClick={() => setShowCreateCGModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!cgTitle.trim() || isCreatingCG) return;
                setIsCreatingCG(true);
                try {
                  const created = await api.createChannelGroup({
                    type: cgType,
                    title: cgTitle.trim(),
                    handle: cgHandle.trim() || undefined,
                    description: cgDescription.trim() || undefined,
                  });
                  setChannelsGroups((prev) => {
                    const exists = prev.some((item) => item.id === created.id);
                    if (exists) return prev;
                    return [created, ...prev];
                  });
                  setShowCreateCGModal(false);
                  setCgTitle('');
                  setCgHandle('');
                  setCgDescription('');
                } catch (err: any) {
                  alert(err.message || 'Ошибка создания');
                } finally {
                  setIsCreatingCG(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Тип канала / группы
                </label>
                <select
                  value={cgType}
                  onChange={(e) => setCgType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 outline-none"
                >
                  <option value="public_channel">📢 Публичный канал</option>
                  <option value="private_channel">🔒 Закрытый канал</option>
                  <option value="public_group">👥 Публичная группа</option>
                  <option value="private_group">🔑 Частная группа</option>
                  <option value="closed_group">🛡️ Закрытая группа</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Название
                </label>
                <input
                  type="text"
                  required
                  value={cgTitle}
                  onChange={(e) => setCgTitle(e.target.value)}
                  placeholder="Например: Новости Orbit AI"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Ссылка / Ссылка на канал (@handle)
                </label>
                <input
                  type="text"
                  value={cgHandle}
                  onChange={(e) => setCgHandle(e.target.value)}
                  placeholder="@orbit_news"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Описание
                </label>
                <textarea
                  rows={2}
                  value={cgDescription}
                  onChange={(e) => setCgDescription(e.target.value)}
                  placeholder="Опишите тему вашего канала или группы…"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCGModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={!cgTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-sky-500/20 active:scale-95 transition"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Folder Manager Modal (Create, Edit & List custom folders) */}
      {showFolderManagerModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowFolderManagerModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 text-xs animate-scale-up max-h-[85vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <FolderPlus className="text-sky-500" size={18} />
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                  {folderManagerMode === 'list' && 'Управление папками'}
                  {folderManagerMode === 'create' && 'Создать новую папку'}
                  {folderManagerMode === 'edit' && 'Редактировать папку'}
                </h3>
              </div>
              <button
                onClick={() => setShowFolderManagerModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Folder List View */}
            {folderManagerMode === 'list' && (
              <div className="flex-1 min-h-0 flex flex-col space-y-3">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] font-medium">
                  <span>Ваши папки: {folders.length} / 10</span>
                  <span className="text-slate-400">Группируйте чаты по темам</span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2 pr-0.5">
                  {folders.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                      <Folder size={32} className="text-slate-300 dark:text-slate-700" />
                      <p className="text-xs">У вас пока нет созданных папок</p>
                    </div>
                  ) : (
                    folders.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 hover:border-sky-500/30 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-9 w-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                            <Folder size={18} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate text-xs">
                              {f.name}
                            </h4>
                            <p className="text-[10px] text-slate-400">
                              {f.contactIds.length} {f.contactIds.length === 1 ? 'диалог' : 'диалогов'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEditFolderManager(f)}
                            className="p-1.5 rounded-xl text-slate-500 hover:text-sky-500 hover:bg-sky-500/10 transition"
                            title="Редактировать папку"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteFolder(f.id, e)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"
                            title="Удалить папку"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <p className="text-[11px] text-slate-400 text-center py-1">
                  Чтобы создать новую папку, зажмите нужный диалог в списке чатов
                </p>
              </div>
            )}

            {/* Create / Edit Folder Form View */}
            {(folderManagerMode === 'create' || folderManagerMode === 'edit') && (
              <div className="flex-1 min-h-0 flex flex-col space-y-3">
                {/* Folder Name Input */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Название папки (макс 12 симв)
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    value={folderFormName}
                    onChange={(e) => setFolderFormName(e.target.value)}
                    placeholder="Например: Работа, Проекты, Личные"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-sky-500 transition"
                    autoFocus
                  />
                </div>

                {/* Contact Selection for Folder */}
                <div className="flex-1 min-h-0 flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <span>Выберите чаты ({folderFormContactIds.length}):</span>
                    {folderFormContactIds.length > 0 && (
                      <button
                        onClick={() => setFolderFormContactIds([])}
                        className="text-sky-500 hover:underline capitalize text-[10px]"
                      >
                        Сбросить
                      </button>
                    )}
                  </div>

                  {/* Search inside contact selector */}
                  <div className="relative shrink-0">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={folderContactSearch}
                      onChange={(e) => setFolderContactSearch(e.target.value)}
                      placeholder="Поиск диалогов..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 outline-none"
                    />
                  </div>

                  {/* Contacts List with Checkboxes */}
                  <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-1.5 pr-0.5 border border-slate-100 dark:border-slate-800 rounded-2xl p-2 bg-slate-50/50 dark:bg-slate-900/50">
                    {combinedContacts.length === 0 ? (
                      <p className="py-6 text-center text-slate-400 text-xs">
                        Нет доступных контактов для добавления
                      </p>
                    ) : (
                      combinedContacts
                        .filter((c) =>
                          !folderContactSearch.trim()
                            ? true
                            : c.name.toLowerCase().includes(folderContactSearch.toLowerCase().trim())
                        )
                        .map((c) => {
                          const isSelected = folderFormContactIds.includes(c.id);
                          return (
                            <div
                              key={c.id}
                              onClick={() => toggleContactInFolderForm(c.id)}
                              className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition ${
                                isSelected
                                  ? 'bg-sky-500/10 border border-sky-500/30'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`h-8 w-8 rounded-full bg-gradient-to-br ${c.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}
                                >
                                  {c.avatarUrl ? (
                                    <img
                                      src={c.avatarUrl}
                                      alt={c.name}
                                      className="h-full w-full rounded-full object-cover"
                                    />
                                  ) : (
                                    c.initials
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                                    {c.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    {c.isChannelGroup ? (c.channelGroupType?.includes('channel') ? 'Канал' : 'Группа') : c.handle}
                                  </p>
                                </div>
                              </div>

                              <div
                                className={`h-5 w-5 rounded-lg flex items-center justify-center border transition shrink-0 ${
                                  isSelected
                                    ? 'bg-sky-500 border-sky-500 text-white'
                                    : 'border-slate-300 dark:border-slate-600'
                                }`}
                              >
                                {isSelected && <Check size={12} strokeWidth={3} />}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setFolderManagerMode('list')}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition"
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFolderManager}
                    disabled={!folderFormName.trim()}
                    className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-sky-500/20 active:scale-95 transition"
                  >
                    {folderManagerMode === 'create' ? 'Создать папку' : 'Сохранить'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Production Contact Sync Modal */}
      <ContactSyncModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onOpenChat={(contact) => openChat(contact)}
        onRefreshContacts={onRefreshContacts}
        onCreateChannelGroup={() => setShowCreateCGModal(true)}
      />
    </div>
  );
};
