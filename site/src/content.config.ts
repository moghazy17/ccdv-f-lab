import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const markdownSchema = z.looseObject({});
const notesBase = new URL(process.env.SITE_NOTES_DIRECTORY_URL ?? "../../notes/", import.meta.url);

export const collections = {
  notes: defineCollection({
    loader: glob({ base: notesBase, pattern: "**/*.md" }),
    schema: markdownSchema
  }),
  guide: defineCollection({
    loader: glob({ base: new URL("../../guide/", import.meta.url), pattern: "**/*.md" }),
    schema: markdownSchema
  }),
  studyPlans: defineCollection({
    loader: glob({ base: new URL("../../study-plans/", import.meta.url), pattern: "**/*.md" }),
    schema: markdownSchema
  }),
  cheatsheets: defineCollection({
    loader: glob({ base: new URL("../../cheatsheets/", import.meta.url), pattern: "**/*.md" }),
    schema: markdownSchema
  })
};
