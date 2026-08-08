import { Story } from '../types';

export interface UserStoryGroup {
  userId: string;
  userName: string;
  userAvatar?: string;
  userColor?: string;
  userInitials?: string;
  stories: Story[];
  hasUnviewed: boolean;
  earliestTimestamp: number;
  latestTimestamp: number;
}

export function groupStoriesByUser(stories: Story[]): UserStoryGroup[] {
  if (!stories || stories.length === 0) return [];

  const map = new Map<string, Story[]>();
  for (const s of stories) {
    if (!map.has(s.userId)) {
      map.set(s.userId, []);
    }
    map.get(s.userId)!.push(s);
  }

  const groups: UserStoryGroup[] = [];

  for (const [userId, userStories] of map.entries()) {
    // Sort stories chronologically
    const sorted = [...userStories].sort((a, b) => a.timestamp - b.timestamp);
    const firstStory = sorted[0];

    const hasUnviewed = sorted.some((s) => !s.viewed);
    const earliestTimestamp = Math.min(...sorted.map((s) => s.timestamp));
    const latestTimestamp = Math.max(...sorted.map((s) => s.timestamp));

    groups.push({
      userId,
      userName: firstStory.userName || 'Пользователь',
      userAvatar: firstStory.userAvatar,
      userColor: firstStory.userColor,
      userInitials: firstStory.userInitials,
      stories: sorted,
      hasUnviewed,
      earliestTimestamp,
      latestTimestamp,
    });
  }

  // Sort groups:
  // 1) Unviewed groups come first (ordered by who posted first)
  // 2) Viewed groups come second (ordered by who posted first)
  groups.sort((a, b) => {
    if (a.hasUnviewed && !b.hasUnviewed) return -1;
    if (!a.hasUnviewed && b.hasUnviewed) return 1;
    return a.earliestTimestamp - b.earliestTimestamp;
  });

  return groups;
}
