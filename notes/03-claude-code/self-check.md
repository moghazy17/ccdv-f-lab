---
domain_name: "Claude Code"
domain_number: 3
domain_weight: "3.1%"
sub_skills:
  - name: "Claude Code Operation"
    weight: "3.1%"
---

# Self-check

Open questions. Answer them aloud or in writing before looking anything up; the site renders these as
reveal cards, and they are not scored.

## Claude Code Operation

1. Name the four instruction-file scopes in the order they load.
2. A project instruction file says "use tabs" and a subdirectory file says "use spaces". What does
   Claude Code actually load, and which instruction wins?
3. You want to guarantee that a command is never run, regardless of what the model decides. Which of
   an instruction file, a settings rule, and a hook achieves that, and why do the others not?
4. Quote, in your own words, what the documentation says about whether instruction files are enforced
   configuration.
5. What is the difference between `/clear` and `/compact`? Which one keeps the conversation going?
6. After `/clear`, is the previous conversation recoverable? How?
7. A `PreToolUse` hook exits with status 2. What happened, and is that a failure?
8. Where does a `PreToolUse` hook get the details of the pending call?
9. You want a teammate to get your custom slash command when they clone the repository. Where does
   the file go, and where would it be useless for that purpose?
10. What distinguishes a built-in command from a bundled skill?
11. Which flag runs Claude Code non-interactively, and what does its exit status tell a script?
12. Name the three `--output-format` values and say when each is the right choice.
13. Streaming output needs more than `--output-format stream-json`. What else, and what is the first
    event and the last line of the stream?
14. What does `--bare` skip, and why would a CI job want that?
15. In auto mode, what reviews an action instead of you?
16. How does `acceptEdits` differ from `dontAsk`?
17. What does `/init` produce?
18. What does a subagent return to the parent conversation, and why is that the reason to use one?
19. How does a Skill differ from a custom tool or an MCP server?
20. This repository's hook is described as protecting a ground-truth file from writes. Name a command
    it denies that writes nothing at all, and explain why.
