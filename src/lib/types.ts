// Answers of the member area API of the membership software (C:/Projekte/mitglieder-software, shared/types.ts).
// A copy of the parts the app uses — keep in step with the software when its member API changes.
import type { ProgrammeIntro } from './intro';

export type Id = string;
export type UnixSec = number;

/** GET /api/public/bootstrap (subset): name and look of the community. */
export interface Bootstrap {
  appName: string; shortName: string; logoUrl: string | null; accentColor: string;
  defaultTheme: 'light' | 'dark' | 'system'; salutation: 'du' | 'sie'; supportEmail: string; version: string;
}

/** GET /api/auth/me (subset). */
export interface Me {
  id: Id; email: string; username: string | null; firstName: string; lastName: string; displayName: string;
  role: 'owner' | 'coowner' | 'admin' | 'staff' | 'member'; memberNo: number; avatarUrl: string | null;
  restricted: boolean; mustChangePassword: boolean; passwordMinLength: number; linkedAccount?: boolean;
}
/** POST /api/auth/login with `X-Client: members-app`. */
export interface LoginResponse { me: Me; token?: string }

export interface Address { company: string; street: string; zip: string; city: string; country: string; vatId: string }
export interface NotifyPrefs { mail: boolean; push: boolean }
/** GET /api/profile. */
export interface Profile {
  id: Id; email: string; username: string | null; firstName: string; lastName: string; displayName: string; avatarUrl: string | null;
  memberNo: number; createdAt: UnixSec; address: Address; notifyUnlock: NotifyPrefs; notifyReply: NotifyPrefs;
}
export interface SessionInfo { id: string; uaLabel: string; ipPrefix: string; createdAt: UnixSec; lastSeenAt: UnixSec; current: boolean }
/** GET /api/member/purchases (subset — the app shows what was bought, no prices). */
export interface Purchase {
  orderId: Id; number: string; productTitle: string; productSlug: string; status: string; createdAt: UnixSec; paidAt: UnixSec | null;
  accessUntil: UnixSec | null; accessLocked: boolean; isTest: boolean;
}
export interface ChangePasswordResponse { me: Me; token?: string }

export type LessonKind = 'video' | 'text' | 'video_text' | 'pdf';

export interface CategoryPrerequisite { id: Id; slug: string; title: string; doneCount: number; lessonCount: number }

export interface CategoryCard {
  id: Id; slug: string; title: string; description: string; coverUrl: string | null; videoCount: number; completedCount: number;
  totalDurationSec: number; access: 'full' | 'teaser' | 'locked'; buyUrl: string | null;
  doneCount: number; lockedBy: CategoryPrerequisite | null; justUnlocked: boolean; sectionCount: number; newCount: number;
}

export interface VideoCard {
  id: Id; title: string; durationSec: number | null; thumbnailUrl: string | null; categoryId: Id; categorySlug: string; categoryTitle: string;
  progressSec: number; completed: boolean; isNew: boolean; commentCount: number; likeCount: number; locked: boolean; sort: number;
  kind: LessonKind; done: boolean; sectionId: Id | null;
}

export interface SectionRef { id: Id; title: string }
export interface SectionCard {
  id: Id; categoryId: Id; title: string; description: string; coverUrl: string | null;
  itemCount: number; doneCount: number; durationSec: number; locked: boolean;
}

export interface ProductRef { slug: string; title: string }
export interface MemberDownload { id: Id; title: string; filename: string; sizeBytes: number }
export interface LessonEmbed { id: Id; title: string; thumbnailUrl: string | null; durationSec: number | null; available: boolean }

export interface VideoDetail extends VideoCard {
  description: string; likedByMe: boolean; readyAt: UnixSec; prevId: Id | null; nextId: Id | null; commentsEnabled: boolean;
  categoryVideos: VideoCard[]; bodyMd: string; watchedSec: number; embeds: LessonEmbed[]; sectionTitle: string | null;
  categorySections: SectionRef[]; file: MemberDownload | null; products: ProductRef[];
}

export interface MemberProduct {
  id: Id; slug: string; title: string; shortDescription: string; description: string; imageUrl: string | null;
  /** The introduction of the programme (lib/intro.ts); null = none, missing on older installations. */
  intro?: ProgrammeIntro | null;
  accessUntil: UnixSec | null; categories: CategoryCard[]; newCount: number; itemCount: number; doneCount: number; downloads: MemberDownload[];
}
export interface MemberProductDetail extends MemberProduct { newItems: VideoCard[] }
export interface MemberLibrary { products: MemberProduct[]; free: CategoryCard[]; more: CategoryCard[]; teasers: CategoryCard[] }
/** A button of the member start page (shared/member-buttons.ts of the software), e.g. "Bewertung abgeben". */
export type HomeButtonIcon = 'chat' | 'star' | 'link' | 'camera' | 'calendar';
export interface MemberHomeButton { id: string; label: string; url: string; icon: HomeButtonIcon; style: 'primary' | 'secondary' }
export interface MemberHome extends MemberLibrary {
  greetingName: string; continueWatching: VideoCard[]; categories: CategoryCard[];
  /** Older installations send none. */
  buttons?: MemberHomeButton[];
  /** "Deine Tools" (09.11.2026); older installations send none. */
  tools?: MemberTool[];
  /** The coach's texts of the app (lib/app-texts.ts); older installations send none. */
  appTexts?: unknown;
  /** The apps of the community (11.11.2026): links and the version of the Android file (lib/app-update.ts); older installations send none. */
  app?: { ios: string | null; android: string | null; androidVersionCode?: number | null; androidVersionName?: string | null };
}
export interface MemberTool { id: string; title: string; url: string; text: string }

export interface MemberCategoryDetail { category: CategoryCard; videos: VideoCard[]; sections: SectionCard[]; products: ProductRef[] }

export interface PlayResponse {
  src: string; expiresAt: UnixSec; renewAfterSec: number; resumeAtSec: number;
  watermark: { enabled: boolean; text: string; opacityPct: number; intervalSec: number };
  exclusive: boolean;
}
export interface ProgressUpdate { positionSec: number; durationSec: number; completed?: boolean }
export interface LessonDoneResult { done: boolean; doneCount: number; lessonCount: number; unlocked: { id: Id; slug: string; title: string }[] }
export interface DownloadLink { url: string; expiresAt: UnixSec }

export interface LikeState { liked: boolean; likeCount: number }
export interface CommentAuthor { id: Id; displayName: string; avatarUrl: string | null; isTeam: boolean }
export interface Comment {
  id: Id; videoId: Id; parentId: Id | null; author: CommentAuthor; body: string; status: 'visible' | 'pending' | 'hidden' | 'deleted';
  pinned: boolean; createdAt: UnixSec; editedAt: UnixSec | null; likeCount: number; likedByMe: boolean; replyCount: number; replies: Comment[];
  canEdit: boolean; canDelete: boolean; canReport: boolean; canModerate: boolean;
}
export interface CommentsPage { items: Comment[]; nextCursor: string | null; total: number }

/** Error body of every API error: `{ error: { code, message?, fields?, details? } }`. */
export interface ApiErrorBody { error?: { code?: string; message?: string; fields?: Record<string, string>; details?: Record<string, unknown> } }
