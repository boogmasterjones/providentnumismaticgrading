/** Provident Studio: turning edited page text back into stored text (plain, paragraphs, Markdoc). */
import { describe, expect, it } from 'vitest';
import { cleanSrc, htmlToMarkdown, paragraphText, plainText, safeHref, type NodeLike } from '../src/lib/studio/richtext';

// A tiny stand-in for DOM nodes: h('p', {}, 'text', h('b', {}, 'bold'))
type Kid = NodeLike | string;
function h(tag: string, attrs: Record<string, string> = {}, ...kids: Kid[]): NodeLike {
  return {
    nodeType: 1,
    nodeName: tag.toUpperCase(),
    nodeValue: null,
    childNodes: kids.map((k) => (typeof k === 'string' ? { nodeType: 3, nodeName: '#text', nodeValue: k, childNodes: [] } : k)),
    getAttribute: (n) => attrs[n] ?? null,
  };
}

describe('one-line text', () => {
  it('flattens whitespace and line breaks', () => {
    expect(plainText(h('h1', {}, '  How a coin\n is ', h('br'), 'graded here. '))).toBe('How a coin is graded here.');
  });
});

describe('paragraph text', () => {
  it('keeps paragraphs and allowed links', () => {
    const el = h('div', {}, h('p', {}, 'First, ', h('a', { href: '/contact' }, 'contact us'), '.'), h('p', {}, 'Second.'));
    expect(paragraphText(el, true)).toBe('First, [contact us](/contact).\n\nSecond.');
    expect(paragraphText(el, false)).toBe('First, contact us.\n\nSecond.');
  });

  it('turns Enter (marked line breaks) into paragraphs and Shift+Enter into a line break', () => {
    expect(paragraphText(h('p', {}, 'One.', h('br', { 'data-sf-p': '1' }), 'Two.'), true)).toBe('One.\n\nTwo.');
    expect(paragraphText(h('p', {}, 'One.', h('br'), 'Two.'), true)).toBe('One.\nTwo.');
  });

  it('drops links Studio does not allow', () => {
    const el = h('p', {}, h('a', { href: 'javascript:alert(1)' }, 'click'), ' and ', h('a', { href: '//evil.example' }, 'here'));
    expect(paragraphText(el, true)).toBe('click and here');
  });
});

describe('formatted text (Markdoc)', () => {
  it('writes headings, bold, italic, links and paragraphs', () => {
    const el = h(
      'div',
      {},
      h('p', {}, 'Intro with ', h('strong', {}, 'bold'), ' and ', h('em', {}, 'italic'), ' and a ', h('a', { href: '/verify' }, 'link'), '.'),
      h('h2', {}, 'Section'),
      h('h3', {}, 'Smaller'),
      h('p', {}, 'Text.'),
    );
    expect(htmlToMarkdown(el)).toBe('Intro with **bold** and _italic_ and a [link](/verify).\n\n## Section\n\n### Smaller\n\nText.\n');
  });

  it('writes lists, quotes, rules and photos', () => {
    const el = h(
      'div',
      {},
      h('ul', {}, h('li', {}, 'One'), h('li', {}, 'Two', h('ul', {}, h('li', {}, 'Nested')))),
      h('ol', {}, h('li', {}, 'First'), h('li', {}, 'Second')),
      h('blockquote', {}, h('p', {}, 'Quoted')),
      h('hr'),
      h('p', {}, h('img', { src: '/api/studio/media/images/blog/a.webp', alt: 'A coin' })),
    );
    expect(htmlToMarkdown(el)).toBe('- One\n- Two\n  - Nested\n\n1. First\n2. Second\n\n> Quoted\n\n---\n\n![A coin](/images/blog/a.webp)\n');
  });

  it('unwraps the containers browsers and Markdoc add, and gathers loose text into paragraphs', () => {
    const el = h('div', {}, h('article', {}, 'Loose text ', h('b', {}, 'here'), h('div', {}, 'A div line')));
    expect(htmlToMarkdown(el)).toBe('Loose text **here**\n\nA div line\n');
  });

  it('escapes characters that would turn into formatting', () => {
    expect(htmlToMarkdown(h('div', {}, h('p', {}, 'Use * and _ and [brackets]')))).toBe('Use \\* and \\_ and \\[brackets\\]\n');
  });

  it('keeps the page-level heading out (h1 becomes h2) and skips empty formatting', () => {
    expect(htmlToMarkdown(h('div', {}, h('h1', {}, 'Big'), h('p', {}, h('strong', {}, ' '), 'x')))).toBe('## Big\n\nx\n');
    expect(htmlToMarkdown(h('div', {}))).toBe('');
  });
});

describe('links and photo addresses', () => {
  it('accepts site pages, anchors, https, mailto and tel', () => {
    for (const ok of ['/contact', '#fees', 'https://example.com/x', 'mailto:a@b.co', 'tel:+19415550100']) expect(safeHref(ok)).toBe(ok);
    for (const bad of ['javascript:alert(1)', '//evil.example', 'data:text/html,x', '']) expect(safeHref(bad)).toBeNull();
    expect(safeHref('/admin/preview/process')).toBe('/process');
  });

  it('points draft photos back at their real address', () => {
    expect(cleanSrc('/api/studio/media/images/home/a.webp')).toBe('/images/home/a.webp');
    expect(cleanSrc('/images/home/a.webp')).toBe('/images/home/a.webp');
  });
});
