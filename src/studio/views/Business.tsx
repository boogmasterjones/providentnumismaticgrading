/** Business info: name, contact details, hours, location, social links and the site switches. */
import { useEffect, useState } from 'react';
import { api, type DocReply } from '../api';
import { useStudio } from '../state';
import { FieldForm } from '../FieldForm';
import { Button, Loading, PageHead } from '../ui';
import { docType } from '../../lib/studio/schema';
import { newProblems, type Data, type FieldProblem } from '../../lib/studio/ops';

const type = docType('settings')!;

export function Business() {
  const { saved, fail, toast, version } = useStudio();
  const [reply, setReply] = useState<DocReply | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [problems, setProblems] = useState<FieldProblem[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.doc('settings').then((r) => {
      setReply(r);
      setData(r.data);
    }, fail);
  }, [fail, version]);

  const dirty = !!reply && !!data && JSON.stringify(reply.data) !== JSON.stringify(data);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function save() {
    if (!data) return;
    const p = newProblems(type, reply, data);
    setProblems(p);
    if (p.length) return toast(p[0].message, 'error');
    setBusy(true);
    try {
      saved('Business info', await api.saveDoc('settings', data));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="st-page st-page-narrow">
      <PageHead back title="Business info" lead="Shown in the footer of every page, on the Contact page and to Google." />
      {!data ? (
        <Loading />
      ) : (
        <>
          <FieldForm
            fields={type.fields}
            value={data}
            onChange={setData}
            problems={problems}
            groups={[
              { title: 'Your business', keys: ['siteName', 'tagline', 'footerText'] },
              { title: 'How people reach you', keys: ['phone', 'email', 'location', 'hours', 'contactNote'] },
              { title: 'Social links', help: 'Shown in the footer. Leave empty for none.', keys: ['socialLinks'] },
              { title: 'Website switches', help: 'Change these only when you are sure.', keys: ['showPopulation', 'launched', 'siteUrl'] },
            ]}
          />
          <div className="st-savebar">
            <span className="st-muted">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</span>
            <span className="st-grow" />
            <Button kind="ghost" disabled={!dirty} onClick={() => reply && setData(reply.data)}>
              Discard
            </Button>
            <Button kind="primary" icon="check" onClick={() => void save()} busy={busy} disabled={!dirty}>
              Save business info
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
