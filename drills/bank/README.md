# Drill-bank format

Each YAML file below this directory is one original practice item. Place it in the directory named
`NN-domain-slug`, where `NN` and the slug match its notes directory. The engine discovers every
`.yaml` file recursively.

Start from the format demonstration in `01-agents-and-workflows/`. Give every item a stable, unique
slug, and copy the domain and sub-skill exactly from `BLUEPRINT.md`. Set `select` to the number of
correct options. Supply four or more options, a rationale for every option, and a `trap_type` for each
incorrect option.

Each source needs a title, URL, and `verified_on` date. Practice items must be original public-outline
exercises, never recalled or reconstructed exam material. Validate additions before sharing them:

```powershell
python -m drills.engine validate
```
