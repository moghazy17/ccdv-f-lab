import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

interface Domain {
  name: string;
  slug: string;
  weight: number;
  subSkills: Array<{ name: string; weight: number }>;
}

interface BlueprintData {
  domains: Domain[];
}

const blueprint = JSON.parse(
  readFileSync(new URL("../../src/data/blueprint.json", import.meta.url), "utf8")
) as BlueprintData;
const claudeCode = blueprint.domains.find((domain) => domain.name === "Claude Code");
if (claudeCode === undefined) {
  throw new Error("Generated blueprint data has no Claude Code domain.");
}
const heavierDomains = blueprint.domains.filter((domain) => domain.weight > claudeCode.weight);

const rankedSurfaces = [
  { route: "./blueprint/", selector: ".blueprint-domain" },
  { route: "./domains/", selector: ".domain-navigation__item" },
  { route: "./cheatsheets/", selector: ".cheatsheet-item" }
];

test("Claude Code follows every heavier domain on ranked surfaces", async ({ page }) => {
  for (const surface of rankedSurfaces) {
    await page.goto(surface.route);
    const labels = await page.locator(surface.selector).allTextContents();
    const claudeCodePosition = labels.findIndex((label) => label.includes(claudeCode.name));
    expect(claudeCodePosition, `${surface.route} must include ${claudeCode.name}`).toBeGreaterThanOrEqual(0);
    for (const heavier of heavierDomains) {
      const heavierPosition = labels.findIndex((label) => label.includes(heavier.name));
      expect(heavierPosition, `${heavier.name} must precede ${claudeCode.name} on ${surface.route}`).toBeLessThan(
        claudeCodePosition
      );
    }
  }
});

test("module surfaces name blueprint-derived sub-skills and add no scored practice", async ({ page }) => {
  const surfaces = [
    { route: "./claude-code/terminal/", names: ["Claude Code Operation"] },
    {
      route: "./claude-code/config/",
      names: ["Configuration Management", "Claude Code Operation", "Claude Hooks"]
    },
    { route: "./playground/", names: ["Claude Code Operation"] }
  ];
  const subSkills = blueprint.domains.flatMap((domain) => domain.subSkills);
  for (const surface of surfaces) {
    await page.goto(surface.route);
    const coverage = page.locator("[data-served-subskills]");
    await expect(coverage).toBeVisible();
    for (const name of surface.names) {
      const subSkill = subSkills.find((candidate) => candidate.name === name);
      if (subSkill === undefined) {
        throw new Error(`Generated blueprint data has no ${name} sub-skill.`);
      }
      await expect(coverage).toContainText(name);
      await expect(coverage).toContainText(`${subSkill.weight.toFixed(1)}%`);
    }
    await expect(page.locator("[data-domain-quiz], [data-score-report]")).toHaveCount(0);
  }
});

test("Claude Code domain page links every module surface", async ({ page }) => {
  await page.goto(`./domains/${claudeCode.slug}/`);
  const region = page.getByTestId("claude-code-surfaces");
  const links = [
    { name: "Terminal simulator", href: "/claude-code/terminal/" },
    { name: "Configuration builder", href: "/claude-code/config/" },
    { name: "Playground", href: "/playground/" }
  ];
  for (const link of links) {
    await expect(region.getByRole("link", { name: link.name })).toHaveAttribute(
      "href",
      new RegExp(`${link.href.replaceAll("/", "\\/")}$`)
    );
  }
});

test("site navigation gains no terminal or configuration-builder entry", async ({ page }) => {
  await page.goto("./");
  const navigation = page.getByRole("navigation", { name: "Site navigation" });
  await expect(navigation.getByRole("link", { name: /terminal simulator/i })).toHaveCount(0);
  await expect(navigation.getByRole("link", { name: /configuration builder/i })).toHaveCount(0);
});
