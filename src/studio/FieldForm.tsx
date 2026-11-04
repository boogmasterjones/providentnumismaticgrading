/**
 * Forms drawn from the field registry (src/lib/studio/schema.ts): every field gets its plain-English label, help
 * text, limit counter and the right control. Used by Business info, notable coins, journal posts, slideshow photos
 * and the visual editor's "Details" panels.
 */
import { useId, useState } from 'react';
import type { Field, ListField } from '../lib/studio/schema';
import type { Data, FieldProblem } from '../lib/studio/ops';
import { ImagePicker } from './ImagePicker';
import { RichEditor } from './RichEditor';
import { viewSrc } from './api';
import { Button, Icon } from './ui';
import { useStudio } from './state';

type OnChange = (v: unknown) => void;

function problemsFor(problems: FieldProblem[], path: string) {
  return problems.filter((p) => p.path === path).map((p) => p.message);
}

export function FieldForm({
  fields,
  value,
  onChange,
  problems = [],
  base = '',
  bodyHtml,
  omit = [],
  groups,
}: {
  fields: Record<string, Field>;
  value: Data;
  onChange: (v: Data) => void;
  problems?: FieldProblem[];
  base?: string;
  bodyHtml?: string;
  omit?: string[];
  groups?: { title: string; help?: string; keys: string[] }[];
}) {
  const one = (k: string) => {
    const f = fields[k];
    if (!f || omit.includes(k)) return null;
    const path = base ? `${base}.${k}` : k;
    const altOf = f.kind === 'image' && f.altField ? f.altField : null;
    return (
      <FieldInput
        key={k}
        f={f}
        path={path}
        value={value[k]}
        onChange={(v) => onChange({ ...value, [k]: v })}
        problems={problems}
        bodyHtml={k === 'body' ? bodyHtml : undefined}
        alt={altOf ? { value: String(value[altOf] ?? ''), set: (a) => onChange({ ...value, [k]: value[k], [altOf]: a }) } : undefined}
        onImage={altOf ? (src, a) => onChange({ ...value, [k]: src, [altOf]: a ?? value[altOf] }) : undefined}
      />
    );
  };
  if (groups) {
    return (
      <div className="st-form">
        {groups.map((g) => (
          <fieldset key={g.title} className="st-group">
            <legend>{g.title}</legend>
            {g.help && <p className="st-help st-group-help">{g.help}</p>}
            {g.keys.map(one)}
          </fieldset>
        ))}
      </div>
    );
  }
  return <div className="st-form">{Object.keys(fields).map(one)}</div>;
}

export function FieldInput({
  f,
  path,
  value,
  onChange,
  problems,
  bodyHtml,
  alt,
  onImage,
}: {
  f: Field;
  path: string;
  value: unknown;
  onChange: OnChange;
  problems: FieldProblem[];
  bodyHtml?: string;
  alt?: { value: string; set: (a: string) => void };
  onImage?: (src: string, alt?: string) => void;
}) {
  const id = useId();
  const errs = problemsFor(problems, path);
  const { confirm } = useStudio();
  const [picking, setPicking] = useState(false);
  const str = typeof value === 'string' ? value : value == null ? '' : String(value);
  const count = (f.kind === 'line' || f.kind === 'text') && f.max ? (
    <span className={`st-count${str.length > f.max ? ' over' : ''}`} aria-live="polite">
      {str.length} / {f.max}
    </span>
  ) : null;
  const head = (
    <>
      <span className="st-field-label">
        {f.label}
        {f.required && <span className="st-req"> (needed)</span>}
        {count}
      </span>
      {f.help && <span className="st-help">{f.help}</span>}
    </>
  );
  const err = errs.length > 0 && (
    <span className="st-field-error" role="alert">
      {errs.join(' ')}
    </span>
  );

  switch (f.kind) {
    case 'line':
      return (
        <label className={`st-field${errs.length ? ' has-error' : ''}`} htmlFor={id}>
          {head}
          <input id={id} type={f.email ? 'email' : 'text'} value={str} maxLength={f.max} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
          {err}
        </label>
      );
    case 'text':
      return (
        <label className={`st-field${errs.length ? ' has-error' : ''}`} htmlFor={id}>
          {head}
          <textarea id={id} value={str} maxLength={f.max} rows={Math.min(12, Math.max(3, Math.ceil(str.length / 70) + str.split('\n').length))} onChange={(e) => onChange(e.target.value)} />
          {f.links && <span className="st-help st-help-small">To link words to a page, write [the words](/contact). A blank line starts a new paragraph.</span>}
          {err}
        </label>
      );
    case 'rich':
      return (
        <div className="st-field">
          {head}
          <RichEditor html={bodyHtml ?? ''} onChange={onChange} label={f.label} folder={path.startsWith('body') ? 'blog' : 'pages'} />
          {err}
        </div>
      );
    case 'image':
      return (
        <div className={`st-field${errs.length ? ' has-error' : ''}`}>
          {head}
          <div className="st-imagefield">
            {str ? <img src={viewSrc(str)} alt="" /> : <div className="st-imagefield-none"><Icon name="photo" size={26} /></div>}
            <div className="st-imagefield-actions">
              <Button icon="photo" onClick={() => setPicking(true)}>
                {str ? 'Change photo' : 'Choose a photo'}
              </Button>
              {str && !f.required && (
                <Button kind="ghost" icon="trash" onClick={() => onChange('')}>
                  Remove
                </Button>
              )}
            </div>
          </div>
          {err}
          {picking && (
            <ImagePicker
              title={f.label}
              folder={f.folder}
              current={str || null}
              alt={alt ? alt.value : undefined}
              altRequired={!!f.required}
              onClose={() => setPicking(false)}
              onDone={(r) => {
                if (r.src) {
                  if (onImage) onImage(r.src, r.alt);
                  else onChange(r.src);
                }
                setPicking(false);
              }}
            />
          )}
        </div>
      );
    case 'bool':
      return (
        <div className="st-field st-field-switch">
          <button
            type="button"
            role="switch"
            aria-checked={value === true}
            className={`st-switch${value === true ? ' on' : ''}`}
            id={id}
            onClick={async () => {
              const next = value !== true;
              if (next && f.confirmOn && !(await confirm({ title: f.label, body: f.confirmOn, confirm: 'Turn it on' }))) return;
              onChange(next);
            }}
          >
            <span />
          </button>
          <label htmlFor={id}>
            <span className="st-field-label">{f.label}</span>
            {f.help && <span className="st-help">{f.help}</span>}
          </label>
        </div>
      );
    case 'select':
      return (
        <label className={`st-field${errs.length ? ' has-error' : ''}`} htmlFor={id}>
          {head}
          <select id={id} value={str} onChange={(e) => onChange(e.target.value)}>
            {!f.required && !f.options.some((o) => o.value === '') && <option value="">Choose…</option>}
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {err}
        </label>
      );
    case 'date':
      return (
        <label className={`st-field st-field-short${errs.length ? ' has-error' : ''}`} htmlFor={id}>
          {head}
          <input id={id} type="date" value={str.slice(0, 10)} onChange={(e) => onChange(e.target.value)} />
          {err}
        </label>
      );
    case 'url':
      return (
        <label className={`st-field${errs.length ? ' has-error' : ''}`} htmlFor={id}>
          {head}
          <input id={id} type="url" inputMode="url" value={str} placeholder="https://" onChange={(e) => onChange(e.target.value)} />
          {err}
        </label>
      );
    case 'number':
      return (
        <label className={`st-field st-field-short${errs.length ? ' has-error' : ''}`} htmlFor={id}>
          {head}
          <input id={id} type="number" inputMode="numeric" value={str} min={f.min} max={f.max} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
          {err}
        </label>
      );
    case 'object':
      return (
        <fieldset className="st-subgroup">
          <legend>{f.label}</legend>
          {f.help && <p className="st-help">{f.help}</p>}
          <FieldForm fields={f.fields} value={(value as Data) ?? {}} onChange={onChange} problems={problems} base={path} />
        </fieldset>
      );
    case 'list':
      return <ListInput f={f} path={path} value={Array.isArray(value) ? value : []} onChange={onChange} problems={problems} />;
  }
}

function ListInput({ f, path, value, onChange, problems }: { f: ListField; path: string; value: unknown[]; onChange: OnChange; problems: FieldProblem[] }) {
  const { confirm } = useStudio();
  const [open, setOpen] = useState<number | null>(null);
  const full = f.maxItems !== undefined && value.length >= f.maxItems;
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
    if (open === i) setOpen(i + d);
  };
  const empty = (): unknown => (f.newItem ? f.newItem() : f.item.kind === 'object' ? {} : '');
  return (
    <fieldset className="st-subgroup st-list">
      <legend>{f.label}</legend>
      {f.help && <p className="st-help">{f.help}</p>}
      {value.length === 0 && <p className="st-muted">None yet.</p>}
      <ol>
        {value.map((item, i) => {
          const label = f.itemLabel ? f.itemLabel(item, i) : `${f.noun} ${i + 1}`;
          const isOpen = open === i || f.item.kind !== 'object';
          return (
            <li key={i} className={`st-list-item${isOpen ? ' open' : ''}`}>
              <div className="st-list-row">
                {f.item.kind === 'object' ? (
                  <button type="button" className="st-list-toggle" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)}>
                    <span className="st-list-n">{i + 1}</span>
                    <span className="st-list-label">{label}</span>
                  </button>
                ) : (
                  <span className="st-list-n">{i + 1}</span>
                )}
                {f.item.kind !== 'object' && (
                  <div className="st-list-inline">
                    <FieldInput f={f.item} path={`${path}.${i}`} value={item} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} problems={problems} />
                  </div>
                )}
                <span className="st-list-tools">
                  <Button small kind="ghost" icon="up" label={`Move ${f.noun} ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} />
                  <Button small kind="ghost" icon="down" label={`Move ${f.noun} ${i + 1} down`} disabled={i === value.length - 1} onClick={() => move(i, 1)} />
                  <Button
                    small
                    kind="ghost"
                    icon="trash"
                    label={`Remove ${f.noun} ${i + 1}`}
                    onClick={async () => {
                      if (await confirm({ title: `Remove this ${f.noun}?`, body: `"${label}" will be removed when you save.`, confirm: 'Remove', danger: true })) {
                        onChange(value.filter((_, j) => j !== i));
                        setOpen(null);
                      }
                    }}
                  />
                </span>
              </div>
              {f.item.kind === 'object' && isOpen && (
                <div className="st-list-body">
                  <FieldInput f={f.item} path={`${path}.${i}`} value={item} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} problems={problems} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <Button
        icon="plus"
        disabled={full}
        title={full ? `${f.maxItems} at most` : undefined}
        onClick={() => {
          onChange([...value, empty()]);
          setOpen(value.length);
        }}
      >
        Add {f.noun}
      </Button>
    </fieldset>
  );
}
