# Contract: the flashcard deck and its card identifier

## The problem this solves

`flashcards/ccdv-f.tsv` holds 30 cards with only **9 distinct fronts**. "Technical Fundamentals"
appears four times with the same domain *and* the same sub-skill, because
`tools/build_flashcards.py` emits one card per note file per sub-skill. Front is not a key. Front
plus domain plus sub-skill is not a key either.

```bash
cut -f1 flashcards/ccdv-f.tsv | sort -u | wc -l   # 9, against 30 lines
```

Without a key, review scheduling has nothing stable to hang on, and regenerating the deck after a
note edit either loses every card's history or attaches it to the wrong card.

## The identifier

`tools/build_flashcards.py` gains a third tag line in the card's **back**, beside the two it already
writes:

```text
Domain: Model Selection and Optimization
Sub-skill: Technical Fundamentals
Card: 05-technical-fundamentals-decision-tables-1
```

The identifier is derived from the card's source position — note directory, note file, sub-skill,
and its ordinal within that group — so it is unique, stable when the card's prose is rewritten, and
stable when other cards are inserted or removed around it.

## Why a tag line and not a third column

The deck's stated purpose is to be importable by Anki and Quizlet, both of which expect two columns.
A third column would break that. The back already carries machine-joinable tags in exactly this
shape, so the identifier joins a convention rather than inventing one, and it stays visible on the
card — which is a small cost against silently losing a candidate's review history.

## What the site does with it

| Rule | Consequence |
|---|---|
| `id` is the only key review state is held against | A rewritten card keeps its box and due date |
| `front` is never used as a key | The four-way collision above cannot corrupt scheduling |
| State for an id absent from the regenerated deck is dropped | And is never reassigned to another card |

## Scheduling

Five Leitner boxes: same session, 1 day, 3 days, 7 days, 21 days. A card marked known moves up one
box; a card marked not known returns to box 1. Two fields per card, `box` and `dueAt`.

That sentence is the whole rule, which is what FR-045 asks for — the page states it, so a candidate
knows what the deck is doing rather than trusting it.

## Coverage

The deck is generated from the notes, and seven of eight domains have none authored, so all 30 cards
come from *Model Selection and Optimization* today. The flashcard surface states which domains the
deck covers and which it does not (FR-044). As notes are written the deck grows with no change here.
