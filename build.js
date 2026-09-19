#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ============================================================================
// Utilities
// ============================================================================

function getAllMarkdownFiles(dir, baseDir = '') {
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = baseDir ? path.join(baseDir, entry.name) : entry.name;
      if (entry.isDirectory()) {
        files.push(...getAllMarkdownFiles(fullPath, relPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // Skip on error
  }
  return files;
}

function parseFrontmatter(content) {
  const lines = content.split('\n');
  if (lines[0] !== '---') {
    return { frontmatter: {}, body: content };
  }

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) {
    return { frontmatter: {}, body: content };
  }

  const fmLines = lines.slice(1, endIdx);
  const bodyLines = lines.slice(endIdx + 1);
  const body = bodyLines.join('\n').trim();

  const frontmatter = {};
  let currentKey = null;
  let currentArray = null;

  for (const line of fmLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Handle nested objects (ai:, origin:, publish:)
    if (line.match(/^(ai|origin|publish):\s*$/)) {
      currentKey = trimmed.slice(0, -1);
      frontmatter[currentKey] = {};
      continue;
    }

    // Handle nested properties (indented lines under ai:, origin:, publish:)
    if (line.startsWith('  ') && currentKey && frontmatter[currentKey]) {
      const nestedLine = trimmed;
      const colonIdx = nestedLine.indexOf(':');
      if (colonIdx > -1) {
        const key = nestedLine.slice(0, colonIdx).trim();
        const val = nestedLine.slice(colonIdx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          frontmatter[currentKey][key] = val.slice(1, -1);
        } else if (val === 'true') {
          frontmatter[currentKey][key] = true;
        } else if (val === 'false') {
          frontmatter[currentKey][key] = false;
        } else if (val === 'null') {
          frontmatter[currentKey][key] = null;
        } else {
          frontmatter[currentKey][key] = val;
        }
      }
      continue;
    }

    // Handle top-level arrays (audience:, tags:)
    if (trimmed.endsWith(':') && !line.startsWith('  ')) {
      currentKey = trimmed.slice(0, -1);
      frontmatter[currentKey] = [];
      currentArray = currentKey;
      continue;
    }

    // Handle array items (lines starting with -)
    if (line.match(/^\s*-\s/) && currentArray) {
      const item = trimmed.slice(2).trim();
      const cleaned = item.startsWith('"') && item.endsWith('"')
        ? item.slice(1, -1)
        : item;
      frontmatter[currentArray].push(cleaned);
      continue;
    }

    // Reset array context if we hit a non-array line
    if (line && !line.startsWith('  ') && !line.match(/^\s*-/)) {
      currentArray = null;
    }

    // Handle regular key: value pairs
    if (!line.startsWith('  ')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > -1) {
        const key = line.slice(0, colonIdx).trim();
        let val = line.slice(colonIdx + 1).trim();

        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        } else if (val === 'true') {
          val = true;
        } else if (val === 'false') {
          val = false;
        } else if (val === 'null') {
          val = null;
        } else if (!isNaN(val) && val !== '') {
          // Try to parse as date if it looks like YYYY-MM-DD
          if (val.match(/^\d{4}-\d{2}-\d{2}$/)) {
            val = val; // Keep as string
          } else {
            val = Number(val);
          }
        }

        frontmatter[key] = val;
        currentKey = null;
      }
    }
  }

  return { frontmatter, body };
}

// ============================================================================
// Markdown to HTML renderer
// ============================================================================

function stripPrivateNotes(markdown) {
  const lines = markdown.split('\n');
  const result = [];
  let inPrivateNotes = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if this is the Private notes heading
    if (trimmed === '## Private notes') {
      inPrivateNotes = true;
      continue;
    }

    // If we're in Private notes, check if we've hit the next heading
    if (inPrivateNotes) {
      if (trimmed.startsWith('##') && !trimmed.startsWith('## Private notes')) {
        inPrivateNotes = false;
        result.push(line);
      }
      // Otherwise, skip the line (we're still in private notes)
      continue;
    }

    result.push(line);
  }

  return result.join('\n').trim();
}

function markdownToHtml(markdown) {
  let html = markdown;

  // Split by table blocks first to handle them specially
  const tableParts = [];
  let currentIdx = 0;
  const tableRegex = /^\|(.+)\|$/gm;

  // Process tables - match header + separator + data rows
  html = html.replace(/^\|.+\|\n\|[\s|-]+\|(\n\|.+\|)*(?=\n\n|\n##|\n#|$)/gm, (match) => {
    const lines = match.trim().split('\n');
    if (lines.length < 2) return match;

    // Check if second line is separator (|---|---|...)
    const separatorLine = lines[1];
    if (!separatorLine.match(/^\|\s*[-:\s|]+\|$/)) {
      return match;
    }

    // This is a table
    const headerRow = lines[0];
    const dataRows = lines.slice(2);

    let table = '<table><thead><tr>';
    const headerCells = headerRow.split('|').filter((c, i) => i > 0 && i < headerRow.split('|').length - 1);
    for (const cell of headerCells) {
      table += '<th>' + escapeHtml(cell.trim()) + '</th>';
    }
    table += '</tr></thead><tbody>';

    for (const row of dataRows) {
      if (!row.trim()) continue;
      table += '<tr>';
      const cells = row.split('|').filter((c, i) => i > 0 && i < row.split('|').length - 1);
      for (const cell of cells) {
        table += '<td>' + escapeHtml(cell.trim()) + '</td>';
      }
      table += '</tr>';
    }

    table += '</tbody></table>';
    return table;
  });

  // Code blocks (must be before inline processing)
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const content = match.slice(3, -3).trim();
    const lines = content.split('\n');
    const lang = lines[0].match(/^[a-z0-9+\-]+$/) ? lines[0] : '';
    const code = lang ? lines.slice(1).join('\n') : content;
    return '<pre><code>' + escapeHtml(code) + '</code></pre>';
  });

  // Headings (before inline processing)
  html = html.replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, text) => {
    const level = hashes.length;
    const content = processInlineMarkdown(text);
    return `<h${level}>${content}</h${level}>`;
  });

  // Paragraphs and block-level elements
  const blocks = html.split('\n\n');
  html = blocks.map(block => {
    block = block.trim();
    if (!block) return '';

    // Skip if it's already HTML
    if (block.startsWith('<')) return block;

    // Bullet lists
    if (block.match(/^\s*-\s/m)) {
      const lines = block.split('\n');
      let list = '<ul>';
      for (const line of lines) {
        const match = line.match(/^\s*-\s+(.+)$/);
        if (match) {
          const content = processInlineMarkdown(match[1]);
          list += `<li>${content}</li>`;
        }
      }
      list += '</ul>';
      return list;
    }

    // Numbered lists
    if (block.match(/^\s*\d+\.\s/m)) {
      const lines = block.split('\n');
      let list = '<ol>';
      for (const line of lines) {
        const match = line.match(/^\s*\d+\.\s+(.+)$/);
        if (match) {
          const content = processInlineMarkdown(match[1]);
          list += `<li>${content}</li>`;
        }
      }
      list += '</ol>';
      return list;
    }

    // Regular paragraph
    const content = processInlineMarkdown(block);
    return `<p>${content}</p>`;
  }).join('');

  return html;
}

function processInlineMarkdown(text) {
  // Escape HTML first
  text = escapeHtml(text);

  // Strong/bold (**text**)
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Emphasis/italic (*text*)
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code (`code`)
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return text;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, c => map[c]);
}

// ============================================================================
// HTML template generation
// ============================================================================

function generateNoteHtml(note) {
  const date = new Date(note.date);
  const dateStr = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let tagsHtml = '';
  if (note.tags && note.tags.length > 0) {
    tagsHtml = '<div class="tags">' +
      note.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('') +
      '</div>';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(note.title)} – TIL</title>
  <style>
    :root {
      --accent: #d97706;
      --text: #1f2937;
      --bg: #faf8f3;
      --border: #e5e0d5;
      --code-bg: #f3f0e8;
    }

    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) {
        --accent: #fbbf24;
        --text: #f3f0e8;
        --bg: #1f1f1f;
        --border: #3a3a3a;
        --code-bg: #2a2a2a;
      }
    }

    :root[data-theme="dark"] {
      --accent: #fbbf24;
      --text: #f3f0e8;
      --bg: #1f1f1f;
      --border: #3a3a3a;
      --code-bg: #2a2a2a;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      font-size: 16px;
    }

    main {
      max-width: 65ch;
      margin: 3rem auto;
      padding: 0 1.5rem;
    }

    h1 {
      font-size: 2.2em;
      font-weight: 700;
      margin-bottom: 0.5em;
      line-height: 1.2;
    }

    h2 {
      font-size: 1.6em;
      font-weight: 700;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      border-bottom: 2px solid var(--accent);
      padding-bottom: 0.25em;
    }

    h3 {
      font-size: 1.25em;
      font-weight: 600;
      margin-top: 1.2em;
      margin-bottom: 0.5em;
    }

    p {
      margin-bottom: 1.2em;
    }

    code {
      background: var(--code-bg);
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace;
      font-size: 0.95em;
    }

    pre {
      background: var(--code-bg);
      border-left: 4px solid var(--accent);
      padding: 1em;
      margin: 1.5em 0;
      overflow-x: auto;
      border-radius: 3px;
    }

    pre code {
      background: none;
      padding: 0;
      font-size: 0.9em;
    }

    ul, ol {
      margin: 1em 0 1.2em 2em;
    }

    li {
      margin-bottom: 0.5em;
    }

    strong {
      font-weight: 600;
      color: var(--accent);
    }

    a {
      color: var(--accent);
      text-decoration: none;
      border-bottom: 1px solid var(--accent);
    }

    a:hover {
      background: var(--accent);
      color: var(--bg);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5em 0;
      border: 1px solid var(--border);
    }

    th, td {
      padding: 0.75em;
      text-align: left;
      border: 1px solid var(--border);
    }

    th {
      background: var(--code-bg);
      font-weight: 600;
      color: var(--accent);
    }

    .meta {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 2em;
      padding-bottom: 1em;
      border-bottom: 1px solid var(--border);
      font-size: 0.95em;
      color: #666;
    }

    @media (prefers-color-scheme: dark) {
      .meta {
        color: #aaa;
      }
    }

    .date {
      color: var(--accent);
      font-weight: 500;
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5em;
    }

    .tag {
      display: inline-block;
      background: var(--code-bg);
      color: var(--accent);
      padding: 0.35em 0.65em;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 500;
    }

    .back-link {
      margin-top: 3em;
      padding-top: 2em;
      border-top: 1px solid var(--border);
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(note.title)}</h1>

    <div class="meta">
      <span class="date">${dateStr}</span>
      ${tagsHtml}
    </div>

    ${note.bodyHtml}

    <div class="back-link">
      <a href="/">← Back to all notes</a>
    </div>
  </main>
</body>
</html>`;
}

function generateIndexHtml(notes) {
  const notesSorted = [...notes].sort((a, b) => new Date(b.date) - new Date(a.date));

  let notesHtml = '';
  for (const note of notesSorted) {
    const date = new Date(note.date);
    const dateStr = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    let tagsHtml = '';
    if (note.tags && note.tags.length > 0) {
      tagsHtml = '<div class="tags">' +
        note.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('') +
        '</div>';
    }

    notesHtml += `
      <article class="note-card">
        <h2><a href="/notes/${note.id}.html">${escapeHtml(note.title)}</a></h2>
        <div class="note-meta">
          <span class="date">${dateStr}</span>
          ${tagsHtml}
        </div>
        <p class="summary">${escapeHtml(note.summary || '')}</p>
      </article>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TIL – Things I Learned</title>
  <style>
    :root {
      --accent: #d97706;
      --text: #1f2937;
      --bg: #faf8f3;
      --border: #e5e0d5;
      --code-bg: #f3f0e8;
    }

    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) {
        --accent: #fbbf24;
        --text: #f3f0e8;
        --bg: #1f1f1f;
        --border: #3a3a3a;
        --code-bg: #2a2a2a;
      }
    }

    :root[data-theme="dark"] {
      --accent: #fbbf24;
      --text: #f3f0e8;
      --bg: #1f1f1f;
      --border: #3a3a3a;
      --code-bg: #2a2a2a;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      font-size: 16px;
    }

    main {
      max-width: 65ch;
      margin: 3rem auto;
      padding: 0 1.5rem;
    }

    h1 {
      font-size: 2.8em;
      font-weight: 700;
      margin-bottom: 0.3em;
      line-height: 1.1;
    }

    .tagline {
      font-size: 1.2em;
      color: #999;
      margin-bottom: 2rem;
    }

    @media (prefers-color-scheme: dark) {
      .tagline {
        color: #666;
      }
    }

    .notes-grid {
      display: grid;
      gap: 2rem;
      margin-top: 2rem;
    }

    .note-card {
      padding: 1.5rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      transition: all 0.2s;
    }

    .note-card:hover {
      border-color: var(--accent);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    @media (prefers-color-scheme: dark) {
      .note-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      }
    }

    .note-card h2 {
      margin: 0 0 0.5em 0;
      font-size: 1.5em;
      border: none;
      padding: 0;
    }

    .note-card a {
      color: var(--text);
      border-bottom: 2px solid var(--accent);
      text-decoration: none;
    }

    .note-card a:hover {
      color: var(--accent);
    }

    .note-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1em;
      font-size: 0.9em;
      flex-wrap: wrap;
    }

    .date {
      color: var(--accent);
      font-weight: 500;
      white-space: nowrap;
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5em;
    }

    .tag {
      display: inline-block;
      background: var(--code-bg);
      color: var(--accent);
      padding: 0.25em 0.6em;
      border-radius: 18px;
      font-size: 0.8em;
      font-weight: 500;
    }

    .summary {
      margin: 0;
      font-size: 0.95em;
      color: #666;
    }

    @media (prefers-color-scheme: dark) {
      .summary {
        color: #aaa;
      }
    }
  </style>
</head>
<body>
  <main>
    <h1>TIL</h1>
    <p class="tagline">Things I learned</p>

    <div class="notes-grid">
      ${notesHtml}
    </div>
  </main>
</body>
</html>`;
}

// ============================================================================
// Main build process
// ============================================================================

function build() {
  console.log('Building TIL site...');

  // Clean dist directory
  const distDir = path.join(__dirname, 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(path.join(distDir, 'notes'), { recursive: true });

  // Read all markdown files
  const contentDir = path.join(__dirname, 'content');
  const mdFiles = getAllMarkdownFiles(contentDir);

  console.log(`Found ${mdFiles.length} markdown files`);

  const notes = [];

  for (const filePath of mdFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    // Filter: only include public, ready/published notes
    const status = frontmatter.status || '';
    const visibility = frontmatter.visibility || '';

    if (!['ready', 'published'].includes(status)) {
      console.log(`  Skipping (status=${status}): ${path.basename(filePath)}`);
      continue;
    }

    if (visibility !== 'public') {
      console.log(`  Skipping (visibility=${visibility}): ${path.basename(filePath)}`);
      continue;
    }

    console.log(`  Including: ${path.basename(filePath)}`);

    // Strip private notes from body
    const cleanedBody = stripPrivateNotes(body);

    // Render markdown to HTML
    const bodyHtml = markdownToHtml(cleanedBody);

    notes.push({
      id: frontmatter.id || '',
      title: frontmatter.title || 'Untitled',
      date: frontmatter.date || new Date().toISOString().split('T')[0],
      summary: frontmatter.summary || '',
      tags: frontmatter.tags || [],
      bodyHtml: bodyHtml
    });
  }

  console.log(`\nBuilding ${notes.length} public notes...`);

  // Generate detail pages
  for (const note of notes) {
    const html = generateNoteHtml(note);
    const notePath = path.join(distDir, 'notes', `${note.id}.html`);
    fs.writeFileSync(notePath, html, 'utf-8');
  }

  // Generate index
  const indexHtml = generateIndexHtml(notes);
  fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml, 'utf-8');

  // Write CNAME
  fs.writeFileSync(path.join(distDir, 'CNAME'), 'til.polyhydragames.com', 'utf-8');

  console.log('\nBuild complete!');
  console.log(`  - Generated ${notes.length} detail pages in dist/notes/`);
  console.log(`  - Generated index at dist/index.html`);
  console.log(`  - Created dist/CNAME`);
}

build();
