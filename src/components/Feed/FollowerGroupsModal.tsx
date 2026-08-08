import React, { useState, useEffect } from 'react';
import { X, Plus, Users, Check, Trash2, Edit2, Search, UserCheck } from 'lucide-react';
import { FollowerGroup, Contact } from '../../types';
import { api } from '../../services/api';

interface FollowerGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  followersList?: Contact[];
  onGroupsUpdated?: (groups: FollowerGroup[]) => void;
}

export const FollowerGroupsModal: React.FC<FollowerGroupsModalProps> = ({
  isOpen,
  onClose,
  followersList = [],
  onGroupsUpdated,
}) => {
  const [groups, setGroups] = useState<FollowerGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingGroup, setEditingGroup] = useState<FollowerGroup | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state for creating/editing
  const [groupName, setGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadGroups();
    }
  }, [isOpen]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await api.getFollowerGroups();
      const loaded = data || [];
      setGroups(loaded);
      localStorage.setItem('orbit_follower_groups', JSON.stringify(loaded));
      if (onGroupsUpdated) onGroupsUpdated(loaded);
    } catch (err) {
      console.error('Failed to load follower groups from API, using fallback:', err);
      try {
        const cached = localStorage.getItem('orbit_follower_groups');
        const parsed = cached ? JSON.parse(cached) : [];
        setGroups(parsed);
        if (onGroupsUpdated) onGroupsUpdated(parsed);
      } catch {
        setGroups([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingGroup(null);
    setGroupName('');
    setSelectedMemberIds([]);
    setSearchQuery('');
  };

  const startEdit = (group: FollowerGroup) => {
    setEditingGroup(group);
    setIsCreating(false);
    setGroupName(group.name);
    setSelectedMemberIds(group.memberIds || []);
    setSearchQuery('');
  };

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSave = async () => {
    if (!groupName.trim()) return;
    setSaving(true);
    try {
      let updatedList: FollowerGroup[] = [];
      if (isCreating) {
        try {
          const res = await api.createFollowerGroup(groupName.trim(), selectedMemberIds);
          if (res.success && res.group) {
            updatedList = [...groups, res.group];
          } else {
            throw new Error('Fallback required');
          }
        } catch {
          const fallbackGroup: FollowerGroup = {
            id: 'group_loc_' + Date.now(),
            name: groupName.trim(),
            memberIds: selectedMemberIds,
          };
          updatedList = [...groups, fallbackGroup];
        }
      } else if (editingGroup) {
        try {
          const res = await api.updateFollowerGroup(editingGroup.id, {
            name: groupName.trim(),
            memberIds: selectedMemberIds,
          });
          if (res.success && res.group) {
            updatedList = groups.map((g) => (g.id === editingGroup.id ? res.group : g));
          } else {
            throw new Error('Fallback required');
          }
        } catch {
          updatedList = groups.map((g) =>
            g.id === editingGroup.id
              ? { ...g, name: groupName.trim(), memberIds: selectedMemberIds }
              : g
          );
        }
      }
      setGroups(updatedList);
      localStorage.setItem('orbit_follower_groups', JSON.stringify(updatedList));
      if (onGroupsUpdated) onGroupsUpdated(updatedList);
      setIsCreating(false);
      setEditingGroup(null);
      setGroupName('');
      setSelectedMemberIds([]);
    } catch (err) {
      console.error('Error saving follower group:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (groupId: string) => {
    try {
      try {
        await api.deleteFollowerGroup(groupId);
      } catch {}
      const updated = groups.filter((g) => g.id !== groupId);
      setGroups(updated);
      localStorage.setItem('orbit_follower_groups', JSON.stringify(updated));
      if (onGroupsUpdated) onGroupsUpdated(updated);
    } catch (err) {
      console.error('Error deleting group:', err);
    }
  };

  if (!isOpen) return null;

  const filteredFollowers = followersList.filter((f) =>
    (f.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-sky-100 dark:bg-sky-900/40 text-sky-500 flex items-center justify-center">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Группы подписчиков</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Сортируйте подписчиков для раздельного доступа к историям и новостям</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4 no-scrollbar">
          {!isCreating && !editingGroup ? (
            <>
              {/* Group List Overview */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Мои группы ({groups.length})</span>
                <button
                  onClick={startCreate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition shadow-xs"
                >
                  <Plus size={14} /> Создать группу
                </button>
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400 animate-pulse">Загрузка групп...</div>
              ) : groups.length === 0 ? (
                <div className="py-10 text-center space-y-2 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                  <UserCheck size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">У вас пока нет созданных групп</p>
                  <p className="text-[11px] text-slate-400">
                    Создайте группы (например, "Близкие друзья", "Семья", "Коллеги"), чтобы показывать определенные публикации только им.
                  </p>
                  <button
                    onClick={startCreate}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 text-white text-xs font-bold shadow-xs hover:bg-sky-600 transition"
                  >
                    <Plus size={14} /> Создать первую группу
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 hover:border-sky-500/50 transition group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                          {group.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-white">{group.name}</h4>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {group.memberIds?.length || 0} участников
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(group)}
                          className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition"
                          title="Редактировать группу"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(group.id)}
                          className="p-2 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition"
                          title="Удалить группу"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Creating / Editing Group Screen */
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {isCreating ? 'Создание новой группы' : 'Редактирование группы'}
                </h4>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setEditingGroup(null);
                  }}
                  className="text-xs text-sky-500 font-semibold hover:underline"
                >
                  Отмена
                </button>
              </div>

              {/* Group Name Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Название группы
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Например: Близкие друзья, Коллеги..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500 text-slate-800 dark:text-white"
                />
              </div>

              {/* Followers Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Выберите участников ({selectedMemberIds.length})
                  </label>
                </div>

                {/* Search in followers */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по подписчикам..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-slate-800 dark:text-white"
                  />
                </div>

                {/* Followers Checkboxes list */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 no-scrollbar pr-1 border border-slate-100 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-800/30">
                  {filteredFollowers.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      {followersList.length === 0 ? 'У вас пока нет подписчиков' : 'Подписчики не найдены'}
                    </div>
                  ) : (
                    filteredFollowers.map((follower) => {
                      const isSelected = selectedMemberIds.includes(follower.id);
                      return (
                        <div
                          key={follower.id}
                          onClick={() => toggleMember(follower.id)}
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition select-none ${
                            isSelected
                              ? 'bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                              {follower.avatarUrl ? (
                                <img src={follower.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                              ) : (
                                (follower.name || 'U').slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800 dark:text-white">{follower.name}</div>
                              <div className="text-[10px] text-slate-400">{follower.username}</div>
                            </div>
                          </div>

                          <div
                            className={`h-5 w-5 rounded-lg flex items-center justify-center transition border ${
                              isSelected
                                ? 'bg-sky-500 border-sky-500 text-white'
                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
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

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2 justify-end">
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setEditingGroup(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSave}
                  disabled={!groupName.trim() || saving}
                  className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition"
                >
                  {saving ? 'Сохранение...' : 'Сохранить группу'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
