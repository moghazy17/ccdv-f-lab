import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const markdownSchema = z.looseObject({});
const notesBase = new URL(process.env.SITE_NOTES_DIRECTORY_URL ?? "../../notes/", import.meta.url);
const guideBase = new URL(process.env.SITE_GUIDE_DIRECTORY_URL ?? "../../guide/", import.meta.url);
const studyPlansBase = new URL(
  process.env.SITE_STUDY_PLANS_DIRECTORY_URL ?? "../../study-plans/",
  import.meta.url
);
const cheatsheetsBase = new URL(
  process.env.SITE_CHEATSHEETS_DIRECTORY_URL ?? "../../cheatsheets/",
  import.meta.url
);

export const collections = {
  notes: defineCollection({
    loader: glob({ base: notesBase, pattern: "**/*.md" }),
    schema: markdownSchema
  }),
  guide: defineCollection({
    loader: glob({ base: guideBase, pattern: "**/*.md" }),
    schema: markdownSchema
  }),
  studyPlans: defineCollection({
    loader: glob({ base: studyPlansBase, pattern: "**/*.md" }),
    schema: markdownSchema
  }),
  cheatsheets: defineCollection({
    loader: glob({ base: cheatsheetsBase, pattern: "**/*.md" }),
    schema: markdownSchema
  })
};
