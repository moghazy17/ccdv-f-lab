# Claude Code behavioural data

`commands.yml` is the simulator's behavioural source. Every command entry must cite a dated anchor
in `SOURCES.md`; the exporter rejects unresolved citations.

This directory holds structured application data, not study prose. The site reads the generated JSON
through its typed loader rather than reading this file directly.
