# Feature Specification: Claude Code simulator, configuration builder, and playground

**Feature Branch**: `003-claude-code-domain`
**Created**: 2026-09-16
**Status**: Draft
**Input**: User description: "Add the Claude Code domain experience: a simulated terminal for
practising built-in and custom slash commands, session management, headless and streaming modes,
and hooks, plus a config builder whose interactive forms generate CLAUDE.md, settings.json, and hook
files the learner can copy straight into a project. Cover the CLAUDE.md hierarchy - enterprise,
user, project, and subdirectory - as something the learner assembles rather than reads about, and
use this repository's own .claude/ directory as the worked example, including the hook that prevents
destructive actions. Add a free-form playground page. Keep the weighting honest: Claude Code is 3.1%
of the exam, roughly 2 items, so this stays a small and clearly-scoped module and must not visually
outrank the 33.1% domain."

## Context that shapes this specification

Seven facts about the repository and the blueprint were verified while writing this spec. Each one
changes what this module can honestly be, and each is treated as a design constraint to be met
openly rather than a surprise to be discovered during implementation.

1. **The module serves three domains, not one.** `BLUEPRINT.md` places *Claude Code Operation* at
   3.1% in domain 3, but it places project instruction files and the settings file under
   *Configuration Management* at 4.1% in domain 2, and hooks as guardrails that prevent destructive
   actions under *Claude Hooks* at 1.0% in domain 7. The three surfaces this feature builds
   therefore stand against roughly 8.2% of the exam, about 4.3 items — not 3.1% and 2. The weighting
   instruction in the brief is right about the *domain*: domain 3 must stay small and must never
   outrank domain 2. It would be wrong as an instruction about the *configuration builder*, which is
   the site's primary teaching surface for a 4.1% sub-skill. This specification keeps both true by
   attributing every surface to the exact sub-skills it serves, and by keeping domain prominence
   derived from domain weights.
2. **The three addresses already exist and nothing links to two of them.** Feature 001 reserved
   `/claude-code/terminal/`, `/claude-code/config/`, and `/playground/` as pages that state they
   hold no capability. `/playground/` is in the site navigation; the two `/claude-code/` addresses
   are reachable from no link on the site. This feature fills all three and gives the two orphans a
   route in, without moving an address.
3. **The repository's own `.claude/README.md` no longer describes its own hook.** The README states
   that the hook denies writes to four ground-truth files. The hook's protected set holds one of
   them; the set was narrowed and the README was not updated. Publishing that directory as the
   worked example would publish a false claim about the one artifact the learner is asked to trust.
   The reconciliation, and a gate that stops the two drifting apart again, are part of this feature.
4. **The hook's own matching is broader than any description of it yet given.** It denies a shell
   command that merely *mentions* a protected filename, anywhere in the command, whether or not the
   command writes anything — a write of this very specification was denied for quoting the
   filename in prose. That is a defensible choice for a safety control, and it is exactly the kind
   of detail a candidate studying hooks should see, but it means the site's description of the hook
   must describe the matching rather than only the intent. Changing the hook is not part of this
   feature; describing it accurately is.
5. **`notes/03-claude-code/` is a scaffold.** All four files carry the authoring prompt and no
   content. Every other surface this feature builds links to that note, and the site's flashcards,
   search, and per-domain recall prompts are generated from the notes. This feature authors the
   note.
6. **The blueprint's statement of the sub-skill is wider than the brief's list.** Beyond the slash
   commands, session management, headless mode, streaming mode, and hooks the brief names, the
   blueprint also names Rules, Skills, Commands, Agents, and Agent Memory as core components, plus
   auto-mode, repository initialization, and the settings file. The repository's `.claude/`
   directory already contains a custom command, a skill, a subagent, a hook, and a settings file, so
   the worked example reaches the components the brief omits without widening the build. Coverage
   follows the blueprint, because the blueprint is what the exam is written from.
7. **The documented hierarchy is not the hierarchy the brief names, and the distinction is the
   module's most valuable teaching point.** `SOURCES.md` records, from Anthropic's Claude Code
   documentation and verified 2026-09-08, that the scopes load in the order managed policy, user,
   project, local; that discovered files are **concatenated into context from the filesystem root
   down, not overridden**; and that a project instruction file is "context, not enforced
   configuration — to block an action regardless of what Claude decides, use a `PreToolUse` hook
   instead". The brief's "enterprise, user, project, and subdirectory" is a reasonable paraphrase,
   and this module teaches the sourced names and the sourced composition rule rather than the
   paraphrase. A learner who leaves believing that the nearest instruction file overrides the ones
   above it, or that a rule written in one is enforced, has learned the wrong thing about a 4.1%
   sub-skill.

## Clarifications

### Session 2026-09-16

- Q: `/playground/` sits in the site navigation beside Labs and the mock exam, which suggests a
  general scratchpad, but the brief introduces it among the Claude Code surfaces. What is it? → A:
  The free-form Claude Code terminal — the same simulator as the module's, with no task, no
  guidance, and no score, where the learner types whatever they want and sees what it does. A Python
  scratchpad over the lab runtime, and a page carrying both a terminal and a Python pane, were both
  considered and rejected: the first duplicates what a lab page already offers with a blank starting
  pane, and the second leaves the page with no answer to "what is this for".
- Q: The module's exercises need explanatory prose — what a hook is, how the hierarchy composes,
  when headless mode is the right shape. `notes/03-claude-code/` is a scaffold. Where does that
  prose live? → A: In `notes/03-claude-code/`, authored by this feature and rendered by the site as
  every other note is. Carrying the prose in a data file beside the exercises, and leaving the note
  a scaffold while the module teaches around it, were both considered and rejected: the first puts
  study content outside the single source the constitution names and hides it from flashcards,
  search, and recall prompts, and the second builds the site's teaching surface for three sub-skills
  on top of a page that says it has not been written.
- Q: The site already ships an in-browser Python runtime. Does the configuration builder execute
  what it generates? → A: Yes. The generated hook runs against sample tool payloads in the browser
  and shows a real deny and a real allow, and the generated settings file is parsed and reported on.
  Generating copyable text with static validation alone was considered and rejected: the sub-skill
  being taught is that a hook enforces where an instruction only suggests, and a learner who never
  sees their own hook refuse anything has been told that rather than shown it.

### Session 2026-09-17

- Q: Which commands does the simulator implement? → A: Everything the blueprint names for the
  sub-skill, plus the small floor without which a session reads as broken — the help, model, cost,
  and permissions commands — for roughly twelve to fifteen in all, each with a dated source, with
  the implemented set shown on the page. The blueprint's list alone, and every documented built-in
  command, were both considered and rejected: the first refuses the first command many candidates
  will type, and the second is an open-ended maintenance commitment against a product that ships
  faster than this repository will, for a domain worth about two items.
- Q: What does the candidate place at each scope in the instruction-hierarchy exercise? → A:
  Prepared instruction fragments they assign to scopes, the set always including at least one
  conflicting pair and at least one rule an instruction file cannot enforce, so the composed result
  has one correct answer that can be checked. Free text at every scope, and a prepared scenario
  followed by a free-text mode, were both considered and rejected: the first lets a candidate
  assemble three harmless fragments and meet neither of the two misconceptions the exercise exists
  to break, and the second doubles the surface for a second mode that teaches nothing the first does
  not.
- Q: What form does the hook file the builder generates take? → A: Python, as the repository's own
  hook is, so that every hook the builder emits can be executed on the page that promises to prove
  it and run locally with nothing installed beyond Python. Offering a shell variant, and offering a
  choice of languages with execution only for Python, were both considered and rejected: each emits
  output the prove-it step cannot cover, which is the one thing that separates this builder from a
  template.
- Q: What does "guided" mean for the module's terminal, as against the free-form playground? → A: A
  short ordered set of tasks covering the features the blueprint names, marked done as the candidate
  performs them and remembered on their device, stated on the page as neither a score nor part of
  any readiness signal. A task list reset on every visit, and commentary with nothing to work
  through, were both considered and rejected: the first loses a returning candidate's place for no
  saving worth having, and the second leaves the guided terminal and the playground differing only
  by tone.
- Q: Are terminal transcripts remembered between visits? → A: No. Both terminals start clean each
  visit and say so; nothing typed into a terminal is ever written to the candidate's device. Guided
  task completion, scope-exercise state, and configuration drafts are still remembered, so nobody
  loses their place. Keeping a capped transcript for both, and keeping one for the module only, were
  both considered and rejected: neither adds anything the remembered task state does not already
  give, both leave a pasted credential sitting in storage after the candidate has forgotten it, and
  both add a retention rule to specify, test, and explain.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Practise a Claude Code session without installing anything (Priority: P1)

A candidate who has never opened Claude Code works through a simulated session: they run built-in
slash commands, invoke a custom command defined by a file, watch what clearing a session discards and
what compacting it keeps, and see the same request issued in headless and in streaming form. Nothing
is installed, no key is asked for, and the page states plainly that the session is a simulation.

**Why this priority**: It is the domain's central surface and the one thing the brief asks for
first. It delivers value on its own, before any other page in this feature exists.

**Independent Test**: Open the terminal page, run a built-in command, a custom command, and a
headless invocation, and confirm each produces the documented result with an explanation and a
citation.

**Acceptance Scenarios**:

1. **Given** the terminal page, **When** the candidate runs a built-in slash command, **Then** the
   simulated result appears with a short explanation of what the command does and a link to the
   source the behavior is taken from.
2. **Given** the terminal page, **When** the candidate runs a command that this repository defines
   as a custom command, **Then** the result shows that the command came from a file in the project,
   names that file, and distinguishes it from a built-in command.
3. **Given** a session with several turns, **When** the candidate runs the command that clears the
   session and then the command that compacts it, **Then** the transcript shows what each one
   discards and what each one keeps, and states the difference.
4. **Given** the terminal page, **When** the candidate issues a request in headless form, **Then**
   the output is the single non-interactive result, distinguished from the interactive session.
5. **Given** a headless request, **When** the candidate asks for streaming output, **Then** the
   events arrive progressively in the documented shape, and the same request in non-streaming form
   is available for comparison.
6. **Given** any command, **When** it runs, **Then** no network request leaves the browser and no
   credential is asked for or read.
7. **Given** a command the simulator does not implement, **When** it runs, **Then** the page says so
   plainly and does not invent a result.

---

### User Story 2 - Assemble the instruction hierarchy and find out what actually enforces (Priority: P2)

A candidate is given instruction files at more than one scope and assembles what Claude Code would
load. They see that the files are concatenated rather than overriding one another, in the documented
order, and they see the point the documentation makes directly: an instruction file shapes behavior,
while a settings rule or a hook enforces it.

**Why this priority**: It is a named part of a 3.1% sub-skill and of a 4.1% one, it is the thing the
brief asks be assembled rather than read, and it is where a candidate most easily carries a wrong
belief into the exam.

**Independent Test**: Assign the prepared fragments to scopes, produce the composed result, and
confirm it matches the documented load order and composition rule; then place the rule an
instruction file cannot enforce and confirm the exercise says so.

**Acceptance Scenarios**:

1. **Given** instruction files at more than one scope, **When** the candidate composes them, **Then**
   the result shows every file's content present, in the documented order, with each contribution
   attributed to its scope.
2. **Given** two scopes whose instructions conflict, **When** the candidate composes them, **Then**
   the exercise shows both instructions present and explains that neither file overrides the other,
   rather than showing one deleted.
3. **Given** an instruction the candidate intends as a prohibition, **When** they ask whether it is
   enforced, **Then** the exercise states that an instruction file is context rather than enforced
   configuration, and names the settings rule or hook that would enforce it.
4. **Given** the composed result, **When** the candidate looks for its source, **Then** a dated
   citation for the load order and the composition rule is one click away.

---

### User Story 3 - Build a configuration and watch it refuse something (Priority: P3)

A candidate fills in forms describing a project and receives a project instruction file, a settings
file, and a hook file. They run the generated hook against sample tool payloads in the browser, see
it deny a destructive action and permit an ordinary one, and copy the files into a project of their
own.

**Why this priority**: It is the site's primary surface for *Configuration Management* at 4.1% and
for *Claude Hooks* at 1.0%, and running the hook is what turns a claim about enforcement into
something the candidate has seen happen.

**Independent Test**: Complete the forms, generate all three files, run the generated hook against a
destructive and an ordinary payload, and copy the files out.

**Acceptance Scenarios**:

1. **Given** the completed forms, **When** the candidate generates, **Then** a project instruction
   file, a settings file, and a hook file are produced, each shown in full and each copyable and
   downloadable.
2. **Given** a generated settings file, **When** it is produced, **Then** it is valid, its permission
   and hook entries are reported back in readable form, and a combination that would not work is
   refused at the form rather than emitted.
3. **Given** a generated hook, **When** the candidate runs it against a payload describing a
   destructive action, **Then** it denies the action and the denial is shown as the hook's own
   output, not as a description of what would happen.
4. **Given** the same hook, **When** it runs against a payload describing an ordinary action,
   **Then** it permits the action.
5. **Given** the runtime cannot be loaded, **When** the candidate generates, **Then** the files are
   still produced and copyable, and the page says the hook cannot be executed here and how to run
   it locally.
6. **Given** generated files, **When** the candidate returns later in the same browser, **Then**
   their form answers are still there and can be discarded.

---

### User Story 4 - Read this repository's own configuration as the worked example (Priority: P4)

A candidate opens the worked example and reads the actual `.claude/` directory of the repository
they are studying: its project instructions, its settings, its custom command, its skill, its
subagent, and the hook that prevents destructive actions — each shown as it is in the repository,
with what it demonstrates named.

**Why this priority**: It is what makes the module concrete, and it costs nothing to keep current
because it renders files that already exist. It follows the exercises because it is what a candidate
turns to after trying something, not before.

**Independent Test**: Open the worked example and confirm every component of the repository's
`.claude/` directory is shown as it is on disk, with the hook's behavior described accurately.

**Acceptance Scenarios**:

1. **Given** the worked example, **When** it renders, **Then** it shows the repository's project
   instructions, settings, custom command, skill, subagent, and hook, each naming the component
   type it demonstrates.
2. **Given** the repository's hook, **When** its behavior is described, **Then** the description
   matches what the hook does, including what its matching actually catches, and publication fails
   if it does not.
3. **Given** a change to the repository's `.claude/` directory, **When** the site is republished,
   **Then** the worked example reflects it with no site file edited.
4. **Given** the worked example, **When** a component is shown, **Then** it links to the file in the
   repository and to the note section that explains it.

---

### User Story 5 - Study the domain from a written note (Priority: P5)

A candidate reads the Claude Code domain note: what the core components are, how the instruction
scopes compose, when headless or streaming is the right shape, and what a hook is for — with the
decision tables and pitfalls the repository's note structure expects, and dated sources throughout.

**Why this priority**: Every other surface in this feature links to this note, and the site's
flashcards, search, and recall prompts are generated from it. It is placed here because the
exercises deliver value against a scaffolded note and improve when it is written, rather than
depending on it.

**Independent Test**: Open the domain page and confirm authored content, a decision table, pitfalls,
recall prompts, and dated citations, with the scaffold notice gone.

**Acceptance Scenarios**:

1. **Given** the domain page, **When** it renders, **Then** it shows authored content rather than an
   authoring prompt, and the scaffold notice is absent.
2. **Given** the note, **When** the site is published, **Then** its cards appear in the flashcard
   deck, its recall prompts on the domain page, and its text in search, with no additional edit.
3. **Given** a factual claim in the note, **When** it is read, **Then** it traces to a dated entry in
   the repository's sources file.
4. **Given** the note, **When** its structure is checked, **Then** its domain and sub-skill names
   match the blueprint exactly.

---

### User Story 6 - Explore freely (Priority: P6)

A candidate opens the playground and types whatever they like into a Claude Code terminal with no
task, no guidance, and no score — trying commands they half-remember, seeing what the simulator
does, and leaving without a record being kept of how they did.

**Why this priority**: It is the smallest surface, it is built entirely from the simulator the first
story delivers, and its value is exploration rather than instruction.

**Independent Test**: Open the playground, run several commands, and confirm it behaves as the
module's terminal does with no task, no scoring, and no readiness effect.

**Acceptance Scenarios**:

1. **Given** the playground, **When** it opens, **Then** it presents a terminal with no task, no
   progress indicator, and no score.
2. **Given** commands run in the playground, **When** they complete, **Then** nothing is recorded
   against the candidate's readiness or quiz results.
3. **Given** the playground, **When** the candidate wants the guided version, **Then** the module's
   terminal is one link away and is described as the guided one.
4. **Given** a session in the playground, **When** the candidate returns in the same browser,
   **Then** the terminal has started clean, the page has said in advance that it would, and nothing
   they typed was written to their device.

---

### Edge Cases

- **A command the simulator does not implement.** It must say so and name what it does implement,
  rather than inventing output that a candidate may carry into an exam.
- **A request that only a model could answer.** A candidate types a question expecting a reply. The
  simulator must not fabricate a model response or imply one was generated.
- **A destructive command typed into the simulator.** Nothing may execute. The simulator must show
  the hook refusing it, which is the lesson, and must never touch the candidate's machine.
- **The simulation is mistaken for the real thing.** Every terminal surface, including the
  playground, must state that it is a simulation and that installing Claude Code is a separate step.
- **Streamed output and assistive technology.** Progressive output must not be announced character
  by character, and the completed result must be readable as a whole.
- **Reduced motion.** Typing effects, streaming animation, and progress indicators must lose no
  information when motion is suppressed.
- **Forced colors and high contrast.** Terminal styling must not be the only carrier of meaning;
  a denied action must be distinguishable without color.
- **An empty configuration.** Forms with nothing chosen must produce either valid minimal files or a
  clear statement that there is nothing to generate — never a malformed file.
- **A configuration that cannot work.** Contradictory permissions, an empty matcher, or a hook with
  no command must be refused at the form with the reason stated, rather than emitted for the
  candidate to debug.
- **A hook that denies more than its description says.** The repository's own hook matches a
  protected filename anywhere in a shell command, so it refuses commands that only mention the file.
  The worked example must describe the matching rather than only the intent, and the same honesty
  must apply to any hook the builder generates.
- **The runtime cannot be fetched or loaded.** The builder must still generate and copy; only the
  execution step degrades, and it must say why.
- **The generated hook loops or never terminates.** The page must stay responsive and recoverable.
- **The clipboard is unavailable or refused.** A download and a selectable, fully visible copy of
  each file must remain.
- **Local storage is unavailable, full, or holds another version's record.** Task completion, scope
  state, and form drafts must degrade to not being remembered, with the page saying so, and no
  surface may break. Terminals are unaffected, because they never write.
- **A narrow screen.** A terminal transcript, a wide generated file, and side-by-side scope panes
  must stay usable without the page scrolling sideways.
- **The repository's `.claude/` directory changes.** A renamed hook, an added skill, or a narrowed
  protected-file set must reach the worked example without a site edit, and must fail publication
  rather than publish a stale description.
- **A candidate pastes a secret.** Nothing typed into any surface here may leave the browser, and
  the pages must say so where a candidate is most likely to paste one. Because no terminal
  transcript is written to the device, a credential pasted into a terminal is gone when the visit
  ends; a credential typed into a form the builder remembers is not, so the forms must not invite
  one.
- **The domain's quiz is two items long.** The module must present that as the weighting rather than
  as an incomplete quiz, and must not pad it.

## Requirements *(mandatory)*

### Functional Requirements

**The simulated terminal**

- **FR-001**: The site MUST provide a simulated Claude Code terminal at the address feature 001
  reserved for it. Every terminal surface MUST state that it is a simulation and MUST NOT imply that
  Claude Code is running.
- **FR-002**: The simulator MUST NOT make any network request, MUST NOT read or ask for a
  credential, and MUST NOT execute anything on the candidate's machine. Typed input MUST never leave
  the browser.
- **FR-003**: Every simulated behavior MUST derive from a single source in the repository that
  carries a dated entry in the repository's sources file. No command's behavior may be written into
  a page, a component, or a style sheet.
- **FR-004**: The simulator MUST support built-in slash commands and MUST distinguish them from
  custom slash commands defined by files, naming the file a custom command came from and the scope
  it was loaded at.
- **FR-005**: The implemented set MUST be bounded and stated on the page, so a candidate can see
  where the simulation stops without having to discover it. The set MUST comprise every command and
  mode the blueprint names for this sub-skill, plus the help, model, cost, and permissions commands
  that a session needs to read as a session. A command outside that set MUST produce an explicit
  statement to that effect and a way to see what is implemented. The simulator MUST NOT produce
  invented output for an unimplemented command.
- **FR-006**: Input that only a model could answer MUST NOT produce a fabricated model response. The
  simulator MUST say what it is and is not able to show.
- **FR-007**: Every command the simulator runs MUST offer a short explanation of what the real
  command does and a link to the dated source that behavior is taken from.
- **FR-008**: The simulator MUST demonstrate session management, including at minimum starting a
  session, resuming or continuing a previous one, clearing a session, and compacting one, and MUST
  show what each of those discards and what each retains.
- **FR-009**: The simulator MUST demonstrate headless mode as a single non-interactive invocation
  distinguished from the interactive session, including how its result is produced for use by
  another program.
- **FR-010**: The simulator MUST demonstrate streaming mode, delivering output progressively in the
  documented event shape, and MUST allow the same request to be seen without streaming for
  comparison.
- **FR-011**: The simulator MUST demonstrate a hook firing before a tool runs, including a denial of
  a destructive action, and MUST make clear that the denial came from the hook rather than from the
  model declining.
- **FR-012**: The simulator MUST cover the core components the blueprint names for this sub-skill —
  rules, skills, commands, agents, and agent memory — and repository initialization and auto-mode,
  at least to the depth of naming each, showing where it lives, and stating what it does.
- **FR-013**: A terminal transcript MUST be clearable by the candidate, and MUST be operable
  entirely from the keyboard, including reaching and re-running earlier commands.
- **FR-013a**: The module's terminal MUST carry a short ordered set of tasks covering the features
  the blueprint names, each marked done when the candidate performs it, with completion remembered
  on their device and discardable. The page MUST state that task completion is neither a score nor
  part of any readiness signal.

**The instruction-scope exercise**

- **FR-014**: The site MUST let a candidate assign prepared instruction fragments to the documented
  scopes and produce the composed result, rather than describing composition in prose alone. The
  fragments offered MUST always include at least one pair that conflicts across scopes and at least
  one rule that an instruction file cannot enforce, so that no arrangement avoids both of the
  misconceptions this exercise exists to correct.
- **FR-015**: The composed result MUST show every scope's contribution present and attributed, in
  the documented load order, and MUST NOT depict a nearer file as replacing or overriding a file
  above it.
- **FR-016**: The exercise MUST state that instruction files are context rather than enforced
  configuration, and MUST name what does enforce — a settings rule, or a hook that runs before the
  tool.
- **FR-017**: The scope names, their order, and the composition rule MUST come from the dated source
  already recorded in the repository, and MUST be cited from the exercise. Where the brief's
  wording and the documented wording differ, the documented wording MUST be what is taught.

**The configuration builder**

- **FR-018**: The site MUST provide a configuration builder at the address feature 001 reserved for
  it, generating a project instruction file, a settings file, and a hook file from the candidate's
  form answers. The hook file MUST be Python, as the repository's own hook is, so that every hook
  the builder emits is one the page can execute and the candidate can run locally without
  installing a further toolchain.
- **FR-019**: Every generated file MUST be shown in full, MUST be copyable, and MUST be
  downloadable. Where the clipboard is unavailable, the file MUST remain fully visible and
  selectable and a download MUST remain available.
- **FR-020**: A generated settings file MUST be valid and MUST be reported back to the candidate in
  readable form — what it permits, what it denies, and what it registers.
- **FR-021**: A combination of answers that would produce a file that cannot work MUST be refused at
  the form, with the reason stated, rather than generated.
- **FR-022**: The candidate MUST be able to run the generated hook in the browser against sample
  tool payloads, and MUST see at minimum one denial of a destructive action and one permitted
  ordinary action, produced by executing the generated file rather than described.
- **FR-023**: Executing a generated hook MUST be subject to the same guarantees as every other
  execution on the site: no network access, no credential access, no blocking of the page, and a run
  that does not terminate MUST leave the page responsive.
- **FR-024**: The execution runtime MUST NOT be fetched until the candidate asks for a hook to be
  run. Generating, reading, copying, and downloading the files MUST all work without it.
- **FR-025**: When the runtime is unavailable, the builder MUST still generate and hand over the
  files, MUST state that execution is unavailable and why, and MUST say how to run the hook locally.
- **FR-026**: The candidate's form answers MUST persist on their device between visits and MUST be
  discardable.
- **FR-027**: Generated content MUST be the candidate's own configuration, not a copy of this
  repository's study prose, and publication MUST fail if study content is duplicated into the
  generator.

**The worked example**

- **FR-028**: The site MUST render this repository's own `.claude/` directory as the worked example,
  read from the repository at publication time. The site MUST NOT hold its own copy, and publication
  MUST fail if one is introduced.
- **FR-029**: The worked example MUST show each component the directory contains — the project
  instruction file, the settings file, the custom command, the skill, the subagent, and the hook —
  and MUST name the component type each demonstrates.
- **FR-030**: Every statement the site makes about what the repository's hook protects MUST match
  what the hook does, including which commands its matching actually catches, and publication MUST
  fail when the two disagree. The repository's own description of the hook MUST be corrected to
  match the hook as part of this feature; the hook's behavior itself MUST NOT be changed here.
- **FR-031**: A change to the repository's `.claude/` directory MUST reach the worked example on the
  next publication with no site file edited, and MUST NOT be describable by a hand-maintained list
  that can go stale silently.
- **FR-032**: Each component in the worked example MUST link to its file in the repository and to
  the note section that explains it, and publication MUST fail if either target does not exist.

**The playground**

- **FR-033**: The site MUST provide a free-form Claude Code terminal at the address feature 001
  reserved for the playground, with no task, no guidance, and no score.
- **FR-034**: The playground MUST be subject to every guarantee the module's terminal carries,
  including the statement that it is a simulation and the prohibition on network and credential
  access.
- **FR-035**: Nothing done in the playground MUST contribute to any readiness signal, quiz result,
  or score report.
- **FR-036**: No terminal transcript, in the module or the playground, MUST be written to the
  candidate's device. Both MUST start clean on each visit, MUST say so, and MUST be clearable within
  a visit.
- **FR-037**: The playground MUST link to the module's guided terminal and MUST describe it as the
  guided one, so a candidate who wants instruction can find it.

**The domain note**

- **FR-038**: This feature MUST author the Claude Code domain note in the repository's existing note
  structure, replacing the authoring prompt with content.
- **FR-039**: The note MUST carry the exact domain and sub-skill names from the blueprint, MUST use
  a decision table wherever the topic is a choice between options, and MUST record pitfalls and
  recall prompts in the structure the repository's notes already use.
- **FR-040**: Every factual claim the note makes about Claude Code MUST trace to a dated entry in
  the repository's sources file.
- **FR-041**: Once authored, the note MUST reach the flashcard deck, the site's search, and the
  domain page's recall prompts through the repository's existing generation, with no additional
  edit.
- **FR-042**: The domain page MUST stop showing the scaffold notice for this domain once the note is
  authored, without that state being set by hand.

**Weighting and prominence**

- **FR-043**: Every weight, item count, and domain ordering this feature displays MUST derive from
  the blueprint through the site's existing build step. No weight may be typed.
- **FR-044**: The Claude Code domain MUST NOT be given greater navigational prominence than a domain
  of higher weight. This feature MUST NOT add a top-level navigation entry for the terminal or the
  configuration builder; both MUST be reached from the Claude Code domain's own page.
- **FR-045**: Each surface this feature adds MUST name the sub-skills it serves, with their
  published weights, so that the configuration builder's relationship to a 4.1% sub-skill and the
  hook exercise's relationship to a 1.0% one are visible rather than implied.
- **FR-046**: This feature MUST NOT change the number of practice items any domain contributes to a
  mock or a quiz, and MUST NOT present its exercises as scored practice.

**Privacy, storage, and continuity**

- **FR-047**: Every surface MUST be fully usable with no account, no installation, and no API key,
  and MUST make no request to a third party at any point.
- **FR-048**: Anything this feature remembers MUST live in its own named area of the progress record
  feature 001 established, MUST be exported and imported with it as one file, and MUST be clearable
  without discarding progress this feature does not own.
- **FR-049**: Behavior when local storage is unavailable, full, or written by a newer version MUST
  be defined and stated on the page rather than discovered.
- **FR-050**: Every address feature 001 and feature 002 established MUST continue to resolve. No
  existing address may be moved or removed.

**Accessibility and performance**

- **FR-051**: Every journey this feature adds MUST be completable using the keyboard alone,
  including the terminal, the scope exercise, the forms, and every copy and download control.
- **FR-052**: Progressive output MUST be announced to assistive technology as a completed result
  rather than continuously, and every surface MUST remain fully informative with motion suppressed
  and with colors forced.
- **FR-053**: No page this feature adds MUST fetch the execution runtime on first render, and every
  page's readable main content MUST arrive within the site's stated performance budget.

### Constitutional constraints *(mandatory — do not delete)*

- **CC-001**: Every weight, item count, and domain ordering shown here is derived from
  `BLUEPRINT.md` through the site's existing build step, including the 3.1% the module states about
  itself and the 4.1% and 1.0% sub-skills its surfaces serve. Satisfied by FR-043, FR-045.
- **CC-002**: The worked example renders the repository's own `.claude/` directory in place and the
  domain note is authored in `notes/03-claude-code/`, rendered from there. No study content is
  copied into the site tree, and publication fails if it is. Satisfied by FR-027, FR-028, FR-038,
  FR-041.
- **CC-003**: Every surface works with no account, no installation, and no key; the simulator makes
  no network request and reads no credential; the one execution path is the site's existing
  origin-served runtime, fetched only on request. Satisfied by FR-002, FR-023, FR-024, FR-047.
- **CC-004**: The Claude Code domain stays at its published prominence and gains no top-level
  navigation entry, while each surface states the sub-skills it actually serves so the module is
  neither padded nor undersold. Satisfied by FR-044, FR-045, FR-046.
- **CC-005**: Every behavior the simulator shows and every claim the note makes traces to a dated
  source entry; Anthropic's material is linked rather than re-hosted; the exercises add no practice
  items and reproduce no exam content. Satisfied by FR-003, FR-007, FR-017, FR-040, FR-046.
- **CC-006**: Every journey is keyboard-operable, streamed output is announced as a result rather
  than continuously, nothing depends on color or motion alone, and the runtime stays off first
  render within the site's stated budget. Satisfied by FR-051, FR-052, FR-053, with the budget in
  SC-010.

### Key Entities

- **Simulated command**: One command the terminal can run. Carries its name, whether it is built in
  or defined by a file, the scope it loads at, the result it produces, the explanation shown
  alongside it, and the dated source its behavior is taken from.
- **Simulated session**: One transcript. Carries its turns, what remains after a clear or a
  compaction, and whether it is the guided module session or a free-form playground one. It lives
  only for the visit and is never written to the candidate's device.
- **Instruction scope**: One level of the hierarchy. Carries its documented name, its position in
  the load order, where its file lives, and the content the candidate placed there.
- **Composed instruction set**: The result of the scope exercise. Carries each scope's contribution
  in order, with attribution, and the statement of what is context and what is enforced.
- **Configuration draft**: The candidate's form answers. Carries what they chose for the project
  instruction file, the settings file, and the hook, and persists on their device until discarded.
- **Generated file**: One output of the builder. Carries its intended path, its content, its
  validation result, and whether it can be executed here.
- **Hook execution result**: One run of a generated hook against one sample payload. Carries the
  payload, the decision, the hook's own output, and whether the run completed.
- **Worked-example component**: One part of the repository's `.claude/` directory. Carries its file,
  the component type it demonstrates, the note section that explains it, and the description the
  site makes of it, which is checked against the file itself.
- **Guided task**: One step in the module terminal's ordered set. Carries what it asks the candidate
  to do, the blueprint feature it covers, and whether they have done it. It is never scored and
  never contributes to readiness.
- **Claude Code module progress**: Everything this feature remembers for one candidate in one
  browser — guided-task completion, scope-exercise state, and configuration drafts, and no terminal
  transcript — held in its own named area of the existing progress record and exported with it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A candidate who has never installed Claude Code runs a built-in command, a custom
  command, a headless invocation, and a streaming invocation within five minutes of opening the
  terminal page, with no account, no installation, and no key at any point.
- **SC-002**: No request leaves the browser for a third party on any page this feature adds,
  including while a generated hook is executing — demonstrated by a deliberate attempt rather than
  asserted.
- **SC-003**: Every behavior the simulator shows traces to a dated source entry, verified
  automatically on every proposed change, with a deliberate unsourced behavior demonstrating that
  publication is blocked.
- **SC-004**: A candidate composes instructions at every documented scope and the result matches the
  documented load order and composition rule exactly, verified automatically against the recorded
  source rather than by reading the page.
- **SC-005**: A candidate completes the builder's forms and obtains three files, runs the generated
  hook, and observes it deny a destructive payload and permit an ordinary one — with the denial
  produced by executing the generated file.
- **SC-006**: Every file the builder generates is valid and usable: placed into an empty project, the
  settings file parses and the hook file runs, verified automatically for a representative set of
  form answers rather than for one.
- **SC-007**: The site's description of this repository's hook matches the hook's actual behavior,
  enforced on every proposed change, with a deliberate mismatch demonstrating that publication is
  blocked.
- **SC-008**: A change to the repository's `.claude/` directory appears in the worked example on the
  next publication with no file under `site/` edited.
- **SC-009**: The Claude Code domain appears at its published weight on every surface that ranks
  domains, gains no top-level navigation entry, and its module adds no scored practice — verified
  against the built site rather than by inspection.
- **SC-010**: Every page this feature adds returns no critical or serious accessibility violations,
  every journey it adds is completable by keyboard alone, and readable main content arrives within
  feature 001's budget of 2.5 seconds on a mid-tier mobile device over a typical mobile connection,
  before any runtime is requested.
- **SC-011**: The Claude Code domain page shows authored content with no scaffold notice, and its
  cards, recall prompts, and search entries appear from that note with no further edit.
- **SC-012**: A candidate uses all four surfaces, exports one file, imports it into a second browser,
  and finds their guided-task completion, scope-exercise state, and configuration drafts present,
  with no terminal transcript in the exported file — and can clear this module's record without
  losing their plans, diagnostic, or mock history.

## Assumptions

- The simulator is a teaching simulation, not an emulator. It reproduces the commands, modes, and
  hook behavior the blueprint names, at the fidelity a dated source supports, and says plainly where
  it stops. Fidelity beyond that is not a goal, and a command that would require a model to answer
  is out of scope by construction.
- The simulator needs a machine-readable description of the commands and modes it reproduces. That
  description is behavioral data with dated sources, not study prose: the explanatory writing lives
  in `notes/03-claude-code/` as clarified, and the two are kept distinct so neither duplicates the
  other.
- The brief's list of features is treated as the floor and the blueprint's statement of the sub-skill
  as the specification. The components the brief omits — rules, skills, agents, agent memory,
  repository initialization, and auto-mode — are covered at the depth of naming, locating, and
  stating their purpose, which is what a roughly two-item domain warrants.
- The generated hook is executed by the in-browser runtime feature 002 already ships. Nothing here
  requires a new runtime, and a browser that cannot hold the existing one degrades to a builder that
  generates and copies but does not execute.
- The configuration the builder generates is the candidate's, for their project. This feature makes
  no claim that a generated configuration is suitable for any particular repository, and the files
  are handed over rather than applied.
- The worked example describes the repository as it is, including where its own history has left an
  inconsistency and where its hook refuses more than its description says. Correcting the
  description is part of this feature; changing what the hook does is not, because its current
  behavior is deliberate.
- Domain 3 carries two items in a 53-item mock and this feature adds none. The module's exercises
  are formative and unscored, exactly as feature 002 established for the notes' recall prompts.
- Results are per browser, reconciled only through export and import, as features 001 and 002
  established.
- Where the brief's wording and the documented wording of the instruction hierarchy differ, the
  documented wording is taught and the brief's wording may appear only as a gloss.
- The other seven domains' notes stay as they are. Authoring the Claude Code note here is
  proportionate to a 3.1% domain and is not a commitment to author the rest in this feature.
