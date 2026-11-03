/** Page loading lives in src/lib/content.ts (it also serves Provident Studio's live preview). */
export type PageSection = {
  mark?: string | null;
  title: string;
  summary?: string | null;
  text?: string | null;
  points?: string[] | null;
};
