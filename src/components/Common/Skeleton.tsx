import React from 'react';

// Primitive Skeleton Bar
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 dark:bg-slate-800/80 rounded-xl relative overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
    </div>
  );
};

// Skeleton Avatar Circle
export const SkeletonAvatar: React.FC<{ size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-11 w-11',
    lg: 'h-14 w-14',
    xl: 'h-20 w-20',
  }[size];

  return <Skeleton className={`rounded-full shrink-0 ${sizeClasses} ${className}`} />;
};

// 1. Home Screen Skeleton (Chats, Stories, Banners)
export const HomeScreenSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 p-4 animate-fade-in max-w-2xl mx-auto">
      {/* Search & Actions Bar Skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 flex-1 rounded-2xl" />
        <Skeleton className="h-10 w-10 rounded-2xl shrink-0" />
      </div>

      {/* Stories Bar Skeleton */}
      <div className="space-y-2 py-1">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
        <div className="flex items-center gap-3 overflow-x-hidden pt-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
              <Skeleton className="h-16 w-16 rounded-2xl" />
              <Skeleton className="h-2.5 w-12 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* AI Action Chips Skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-28 rounded-xl" />
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Skeleton className="h-8 w-24 rounded-xl" />
      </div>

      {/* Chat List Skeletons */}
      <div className="space-y-2.5 pt-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-3 w-12 rounded-md" />
        </div>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 shadow-2xs"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <SkeletonAvatar size="md" />
              <div className="space-y-2 flex-1 min-w-0">
                <Skeleton className="h-3.5 w-2/5 rounded-md" />
                <Skeleton className="h-3 w-4/5 rounded-md" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 ml-2">
              <Skeleton className="h-2.5 w-8 rounded-md" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 2. Chat Screen Skeleton (Active Chat & Messages)
export const ChatScreenSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto p-4 space-y-4 animate-fade-in">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <SkeletonAvatar size="md" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>

      {/* Message Bubbles Skeleton */}
      <div className="flex-1 space-y-4 py-2 overflow-hidden">
        <div className="flex justify-start">
          <div className="flex items-end gap-2 max-w-[70%]">
            <SkeletonAvatar size="sm" />
            <Skeleton className="h-12 w-48 rounded-2xl rounded-bl-xs" />
          </div>
        </div>

        <div className="flex justify-end">
          <Skeleton className="h-16 w-56 rounded-2xl rounded-br-xs" />
        </div>

        <div className="flex justify-start">
          <div className="flex items-end gap-2 max-w-[70%]">
            <SkeletonAvatar size="sm" />
            <Skeleton className="h-24 w-64 rounded-2xl rounded-bl-xs" />
          </div>
        </div>

        <div className="flex justify-end">
          <Skeleton className="h-10 w-36 rounded-2xl rounded-br-xs" />
        </div>

        <div className="flex justify-start">
          <div className="flex items-end gap-2 max-w-[70%]">
            <SkeletonAvatar size="sm" />
            <Skeleton className="h-14 w-52 rounded-2xl rounded-bl-xs" />
          </div>
        </div>
      </div>

      {/* Input Bar Skeleton */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        <Skeleton className="h-11 flex-1 rounded-2xl" />
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      </div>
    </div>
  );
};

// 3. Feed Screen Skeleton (News, Channel Posts)
export const FeedScreenSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 p-4 animate-fade-in max-w-2xl mx-auto">
      {/* Filter Tabs Skeleton */}
      <div className="flex items-center gap-2 overflow-x-hidden">
        <Skeleton className="h-9 w-24 rounded-2xl" />
        <Skeleton className="h-9 w-28 rounded-2xl" />
        <Skeleton className="h-9 w-20 rounded-2xl" />
      </div>

      {/* Feed Cards Skeleton */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-4 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800/80 shadow-2xs space-y-3"
        >
          {/* Author Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SkeletonAvatar size="md" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-28 rounded-md" />
                <Skeleton className="h-2.5 w-16 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>

          {/* Text Content */}
          <div className="space-y-2 py-1">
            <Skeleton className="h-3.5 w-full rounded-md" />
            <Skeleton className="h-3.5 w-4/5 rounded-md" />
          </div>

          {/* Media Box */}
          <Skeleton className="h-48 w-full rounded-2xl" />

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-4">
              <Skeleton className="h-7 w-16 rounded-xl" />
              <Skeleton className="h-7 w-16 rounded-xl" />
              <Skeleton className="h-7 w-16 rounded-xl" />
            </div>
            <Skeleton className="h-7 w-8 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
};

// 4. Wallet Screen Skeleton
export const WalletScreenSkeleton: React.FC = () => {
  return (
    <div className="space-y-5 p-4 animate-fade-in max-w-2xl mx-auto">
      {/* Main Balance Card Skeleton */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800/90 dark:to-slate-900/90 shadow-md space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-3.5 w-28 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
        <Skeleton className="h-9 w-48 rounded-xl" />
        <div className="grid grid-cols-3 gap-2 pt-2">
          <Skeleton className="h-10 rounded-2xl" />
          <Skeleton className="h-10 rounded-2xl" />
          <Skeleton className="h-10 rounded-2xl" />
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>

      {/* Transaction History Header */}
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-4 w-36 rounded-md" />
        <Skeleton className="h-3 w-16 rounded-md" />
      </div>

      {/* Transactions List */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between p-3.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-2xl shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-32 rounded-md" />
              <Skeleton className="h-2.5 w-20 rounded-md" />
            </div>
          </div>
          <div className="space-y-1.5 text-right">
            <Skeleton className="h-3.5 w-20 rounded-md ml-auto" />
            <Skeleton className="h-2.5 w-12 rounded-md ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
};

// 5. Profile Screen Skeleton
export const ProfileScreenSkeleton: React.FC = () => {
  return (
    <div className="space-y-5 p-4 animate-fade-in max-w-2xl mx-auto">
      {/* Profile Header Skeleton */}
      <div className="p-6 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800/80 shadow-2xs flex flex-col items-center gap-3 text-center">
        <SkeletonAvatar size="xl" />
        <Skeleton className="h-5 w-40 rounded-lg" />
        <Skeleton className="h-3.5 w-28 rounded-md" />
        <div className="flex items-center gap-2 pt-2 w-full max-w-xs">
          <Skeleton className="h-9 flex-1 rounded-2xl" />
          <Skeleton className="h-9 flex-1 rounded-2xl" />
        </div>
      </div>

      {/* Settings Sections Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-28 rounded-md ml-1" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
              <Skeleton className="h-3.5 w-36 rounded-md" />
            </div>
            <Skeleton className="h-4 w-4 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
};

// 6. AI Assistant Screen Skeleton
export const AIScreenSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 p-4 animate-fade-in max-w-2xl mx-auto h-full flex flex-col">
      {/* AI Header Skeleton */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <Skeleton className="h-10 w-10 rounded-2xl shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-2.5 w-36 rounded-md" />
        </div>
      </div>

      {/* AI Chat History */}
      <div className="flex-1 space-y-4 py-2 overflow-hidden">
        <div className="flex justify-start">
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800/80 space-y-2 max-w-[85%]">
            <Skeleton className="h-3.5 w-full rounded-md" />
            <Skeleton className="h-3.5 w-4/5 rounded-md" />
            <Skeleton className="h-3.5 w-2/3 rounded-md" />
          </div>
        </div>

        <div className="flex justify-end">
          <Skeleton className="h-10 w-48 rounded-2xl" />
        </div>

        <div className="flex justify-start">
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800/80 space-y-2 max-w-[85%]">
            <Skeleton className="h-3.5 w-full rounded-md" />
            <Skeleton className="h-3.5 w-3/4 rounded-md" />
          </div>
        </div>
      </div>

      {/* AI Input Skeleton */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
        <Skeleton className="h-11 flex-1 rounded-2xl" />
        <Skeleton className="h-11 w-11 rounded-2xl shrink-0" />
      </div>
    </div>
  );
};
