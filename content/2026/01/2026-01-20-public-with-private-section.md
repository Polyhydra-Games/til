---
til_version: "0.1"
id: "2026-01-20-public-with-private-section"
title: "A public note that also has a Private notes section"
date: 2026-01-20
status: ready
visibility: public
audience:
  - general
tags:
  - test-fixture
summary: "Test fixture: this note IS public and should render, but its Private notes section must be stripped from the output."
source_type: observation
confidence: high
ai:
  assisted: false
  disclosure: null
origin:
  kind: manual
  refs: []
canonical: null
publish:
  lancer1977: true
  devto: false
  hashnode: false
publish_meta: {}
created: "2026-01-20T09:00:00-04:00"
updated: "2026-01-20T09:00:00-04:00"
---

# A public note that also has a Private notes section

## Lesson

This note is public and should appear in the built site, with this Lesson section visible.

## Private notes

SHOULD-NEVER-APPEAR-IN-OUTPUT — if this literal string shows up anywhere under `dist/`, the exporter failed to strip the Private notes section.
