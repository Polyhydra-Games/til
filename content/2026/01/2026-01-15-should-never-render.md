---
til_version: "0.1"
id: "2026-01-15-should-never-render"
title: "This note must never appear in the built site"
date: 2026-01-15
status: draft
visibility: private
audience:
  - general
tags:
  - test-fixture
summary: "Test fixture for the TIL engine's build filter. If this shows up anywhere in dist/, the filter is broken."
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
  lancer1977: false
  devto: false
  hashnode: false
publish_meta: {}
created: "2026-01-15T09:00:00-04:00"
updated: "2026-01-15T09:00:00-04:00"
---

# This note must never appear in the built site

## Lesson

This is a `status: draft`, `visibility: private` fixture used to verify the build filter excludes non-public content.

## Private notes

If any exporter or build ever includes this section's contents in public output, that is a bug — TIL-PNS requires this section to be stripped unconditionally, even on notes that ARE public.
