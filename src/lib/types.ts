// Answers of the member area API of the membership software (C:/Projekte/mitglieder-software, shared/types.ts).
// A copy of the parts the app uses — keep in step with the software when its member API changes.
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
  role: 'owner' | 'admin' | 'editor' | 'support' | 'member'; memberNo: number; avatarUrl: string | null;
  restricted: boolean; mustChangePassword: boolean;
}
/** POST /api/auth/login with `X-Client: members-app`. */
export interface LoginResponse { me: Me; token?: string }

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
  accessUntil: UnixSec | null; categories: CategoryCard[]; newCount: number; itemCount: number; doneCount: number; downloads: MemberDownload[];
}
export interface MemberProductDetail extends MemberProduct { newItems: VideoCard[] }
export interface MemberLibrary { products: MemberProduct[]; free: CategoryCard[]; more: CategoryCard[]; teasers: CategoryCard[] }
export interface MemberHome extends MemberLibrary { greetingName: string; continueWatching: VideoCard[]; categories: CategoryCard[] }

export interface MemberCategoryDetail { category: CategoryCard; videos: VideoCard[]; sections: SectionCard[]; products: ProductRef[] }

export interface PlayResponse {
  src: string; expiresAt: UnixSec; renewAfterSec: number; resumeAtSec: number;
  watermark: { enabled: boolean; text: string; opacityPct: number; intervalSec: number };
  exclusive: boolean;
}
export interface ProgressUpdate { positionSec: number; durationSec: number; completed?: boolean }
export interface LessonDoneResult { done: boolean; doneCount: number; lessonCount: number; unlocked: { id: Id; slug: string; title: string }[] }
export interface DownloadLink { url: string; expiresAt: UnixSec }

/** Error body of every API error: `{ error: { code, message?, fields?, details? } }`. */
export interface ApiErrorBody { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
