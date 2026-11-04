/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /**
     * Set only inside Provident Studio's live preview (/admin/preview/…, signed in): the drafts to render and the
     * edit flag that turns on the editing annotations. Never set for public pages.
     */
    studio?: import('./lib/content').StudioLocals;
  }
}
