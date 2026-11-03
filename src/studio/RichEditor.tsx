/**
 * Formatted text editing (page text, journal posts): headings, bold, italic, lists, links and photos, saved as
 * Markdoc. The text is edited as it will look; it is turned back into Markdoc by src/lib/studio/richtext.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { htmlToMarkdown, safeHref } from '../lib/studio/richtext';
import { ImagePicker } from './ImagePicker';
import { viewSrc } from './api';
import { Icon } from './ui';

export function RichEditor({ html, onChange, label, folder = 'blog' }: { html: string; onChange: (md: string) => void; label: string; folder?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [linking, setLinking] = useState<{ range: Range; href: string } | null>(null);
  const [picking, setPicking] = useState<{ range: Range | null; img?: HTMLImageElement } | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = html;
    // draft photos show through Studio's media route; the saved text keeps /images/… (richtext.ts cleanSrc)
    for (const img of ref.current.querySelectorAll('img')) img.src = viewSrc(img.getAttribute('src'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => ref.current && onChange(htmlToMarkdown(ref.current));
  const cmd = (c: string, v?: string) => {
    ref.current?.focus();
    document.execCommand(c, false, v);
    emit();
  };
  const block = (tag: 'h2' | 'h3') => {
    const n = getSelection()?.anchorNode;
    const cur = (n instanceof Element ? n : n?.parentElement)?.closest('h2,h3,p,li');
    cmd('formatBlock', cur?.tagName.toLowerCase() === tag ? 'p' : tag);
  };
  const selRange = () => {
    const s = getSelection();
    return s && s.rangeCount && ref.current?.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null;
  };

  return (
    <div className="st-rich">
      <div className="st-rich-bar" role="toolbar" aria-label={`Formatting for ${label}`} onMouseDown={(e) => e.preventDefault()}>
        <button type="button" onClick={() => cmd('bold')} title="Bold (Ctrl+B)" aria-label="Bold">
          <b>B</b>
        </button>
        <button type="button" onClick={() => cmd('italic')} title="Italic (Ctrl+I)" aria-label="Italic">
          <i>I</i>
        </button>
        <span className="st-rich-sep" />
        <button type="button" onClick={() => block('h2')} title="Heading">
          Heading
        </button>
        <button type="button" onClick={() => block('h3')} title="Smaller heading">
          Subheading
        </button>
        <button type="button" onClick={() => cmd('insertUnorderedList')} title="Bulleted list">
          • List
        </button>
        <span className="st-rich-sep" />
        <button
          type="button"
          title="Link the selected words"
          onClick={() => {
            const r = selRange();
            if (!r || r.collapsed) return alert('First select the words to link, then press Link.');
            const a = (r.commonAncestorContainer instanceof Element ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement)?.closest('a');
            setLinking({ range: r, href: a?.getAttribute('href') ?? '' });
          }}
        >
          Link
        </button>
        <button type="button" title="Insert a photo" onClick={() => setPicking({ range: selRange() })}>
          <Icon name="photo" size={16} /> Photo
        </button>
      </div>
      {linking && (
        <form
          className="st-rich-link"
          onSubmit={(e) => {
            e.preventDefault();
            const href = safeHref(linking.href);
            if (!href) return alert('Use a page of this site (like /contact) or an address starting with https://');
            const s = getSelection()!;
            s.removeAllRanges();
            s.addRange(linking.range);
            cmd('createLink', href);
            setLinking(null);
          }}
        >
          <input autoFocus aria-label="Link address" placeholder="/contact or https://…" value={linking.href} onChange={(e) => setLinking({ ...linking, href: e.target.value })} />
          <button type="submit" className="st-btn st-btn-primary st-btn-small">
            Link
          </button>
          <button
            type="button"
            className="st-btn st-btn-ghost st-btn-small"
            onClick={() => {
              const s = getSelection()!;
              s.removeAllRanges();
              s.addRange(linking.range);
              cmd('unlink');
              setLinking(null);
            }}
          >
            Remove link
          </button>
          <button type="button" className="st-btn st-btn-ghost st-btn-small" onClick={() => setLinking(null)}>
            Cancel
          </button>
        </form>
      )}
      <div
        ref={ref}
        className="st-rich-area prose-like"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        onFocus={() => document.execCommand('defaultParagraphSeparator', false, 'p')}
        onInput={emit}
        onBlur={emit}
        onClick={(e) => {
          if (e.target instanceof HTMLImageElement) setPicking({ range: null, img: e.target });
        }}
        onPaste={(e) => {
          e.preventDefault();
          const t = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
          const html = t
            .split(/\n{2,}/)
            .map((p) => `<p>${p.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!).replace(/\n/g, '<br>')}</p>`)
            .join('');
          document.execCommand('insertHTML', false, html);
          emit();
        }}
      />
      {picking && (
        <ImagePicker
          title={picking.img ? 'Photo in the text' : 'Insert a photo'}
          folder={folder}
          current={picking.img ? picking.img.getAttribute('src')?.replace(/^\/api\/studio\/media/, '') : null}
          alt={picking.img ? picking.img.alt : ''}
          removable={!!picking.img}
          onClose={() => setPicking(null)}
          onDone={(r) => {
            if (picking.img) {
              if (r.remove) picking.img.remove();
              else {
                picking.img.src = viewSrc(r.src);
                picking.img.alt = r.alt ?? '';
              }
            } else if (r.src && ref.current) {
              const p = document.createElement('p');
              const img = document.createElement('img');
              img.src = viewSrc(r.src);
              img.alt = r.alt ?? '';
              p.append(img);
              const at = picking.range?.startContainer;
              const blockEl = (at instanceof Element ? at : at?.parentElement)?.closest('p,h2,h3,ul,ol,blockquote');
              if (blockEl && ref.current.contains(blockEl)) blockEl.after(p);
              else ref.current.append(p);
            }
            setPicking(null);
            emit();
          }}
        />
      )}
    </div>
  );
}
