/**
 * A panel that edits part of a document with a form: one field, one list item (a step, a slide…), or the whole
 * document. Used by the visual editor's "Details", by the page settings and by Business info style screens.
 */
import { useEffect, useMemo, useState } from 'react';
import { api, type DocReply } from './api';
import { FieldForm, FieldInput } from './FieldForm';
import { useStudio } from './state';
import { Button, Loading, Sheet } from './ui';
import { docType, fieldAt, type Field } from '../lib/studio/schema';
import { getAt, newProblems, setAt, type Data, type FieldProblem } from '../lib/studio/ops';

export function DocSheet({
  doc,
  path = '',
  title,
  subtitle,
  onClose,
  onSaved,
  omit,
}: {
  doc: string;
  path?: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onSaved?: () => void;
  omit?: string[];
}) {
  const { saved, fail } = useStudio();
  const type = docType(doc);
  const [reply, setReply] = useState<DocReply | null>(null);
  const [data, setData] = useState<Data>({});
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<FieldProblem[]>([]);

  useEffect(() => {
    api.doc(doc).then(
      (r) => {
        setReply(r);
        setData(r.data);
      },
      (e) => {
        fail(e);
        onClose();
      },
    );
  }, [doc, fail, onClose]);

  const field: Field | null = useMemo(() => (type && path ? fieldAt(type, path) : null), [type, path]);
  if (!type) return null;
  const label = title ?? (field ? field.label : type.label);
  const dirty = reply && JSON.stringify(reply.data) !== JSON.stringify(data);

  async function save() {
    if (!type || !reply) return;
    // a formatted body edited here arrives as data.body; it is saved separately from the fields
    const { body: newBody, ...fields } = data;
    const body = typeof newBody === 'string' ? newBody : undefined;
    const found = newProblems(type, reply, fields, body ?? reply.body);
    const relevant = path ? found.filter((p) => p.path === path || p.path.startsWith(path + '.')) : found;
    setProblems(relevant);
    if (relevant.length) return;
    setBusy(true);
    try {
      const top = path ? path.split('.')[0] : null;
      const payload = top ? { [top]: fields[top] } : fields;
      const r = await api.saveDoc(doc, payload, body);
      saved(label, r);
      onSaved?.();
      onClose();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={label}
      subtitle={subtitle ?? (field?.help || undefined)}
      onClose={onClose}
      wide={!path}
      footer={
        <>
          <span className="st-grow" />
          <Button kind="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button kind="primary" icon="check" onClick={() => void save()} busy={busy} disabled={!dirty}>
            Save
          </Button>
        </>
      }
    >
      {!reply ? (
        <Loading />
      ) : path && field ? (
        field.kind === 'object' ? (
          <FieldForm fields={field.fields} value={(getAt(data, path) as Data) ?? {}} onChange={(v) => setData(setAt(data, path, v))} problems={problems} base={path} />
        ) : (
          <div className="st-form">
            <FieldInput f={field} path={path} value={getAt(data, path)} onChange={(v) => setData(setAt(data, path, v))} problems={problems} />
          </div>
        )
      ) : (
        <FieldForm
          fields={type.fields}
          value={data}
          onChange={setData}
          problems={problems}
          bodyHtml={reply.bodyHtml}
          omit={omit}
          groups={type.type === 'page' ? pageGroups(Object.keys(type.fields), omit) : undefined}
        />
      )}
    </Sheet>
  );
}

function pageGroups(keys: string[], omit: string[] = []) {
  const meta = ['metaTitle', 'metaDescription'];
  const top = ['eyebrow', 'heading', 'intro'];
  const rest = keys.filter((k) => !meta.includes(k) && !top.includes(k) && k !== 'body' && !omit.includes(k));
  return [
    { title: 'On Google', help: 'How this page appears in search results and in the browser tab.', keys: meta },
    { title: 'Top of the page', keys: top },
    ...(rest.length ? [{ title: 'Everything else on this page', help: 'You can also click these directly on the page.', keys: rest }] : []),
  ];
}
