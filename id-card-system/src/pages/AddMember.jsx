import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, IdCard, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import MemberForm from '../components/MemberForm';
import CardStage from '../components/CardStage';
import organizationDefaults from '../config/organization.default';
import { validateMemberForm } from '../utils/validation';
import { addMonths, toISODate, today } from '../utils/date';
import { suggestNextId } from '../utils/idGenerator';
import { buildVerifyUrl } from '../utils/verification';
import { createMember, existingMemberIds } from '../services/localStore';

/**
 * AddMember
 * ---------------------------------------------------------------------------
 * The form and the card preview are driven by a single `values` object, so
 * every keystroke updates the card immediately. There is no separate "generate"
 * step and nothing to position by hand - the template is fixed.
 */
export default function AddMember({ organization = organizationDefaults }) {
  const navigate = useNavigate();
  const formRef = useRef(null);

  const [values, setValues] = useState(() => ({
    fullName: '',
    memberId: '',
    designation: '',
    state: '',
    district: '',
    photoUrl: null,
    photoFile: null,
    validFrom: toISODate(today()),
    validUntil: toISODate(addMonths(today(), organization.defaultValidityMonths ?? 12)),
    status: 'active',
    revocationReason: '',
  }));

  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null); // { kind: 'ok'|'error', text }
  const [saving, setSaving] = useState(false);

  const knownIds = useMemo(() => existingMemberIds(), []);

  // Pre-fill the next free ID, but let the admin type over it.
  useEffect(() => {
    setValues((v) => (v.memberId ? v : { ...v, memberId: suggestNextId(organization, knownIds) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const memberForCard = {
    name: values.fullName,
    designation: values.designation,
    state: values.state,
    memberId: values.memberId,
    validUntil: values.validUntil,
    photoUrl: values.photoUrl,
  };

  async function handleSave(event) {
    event.preventDefault();
    setBanner(null);

    const result = validateMemberForm(values, knownIds);
    setErrors(result.errors);

    if (!result.ok) {
      setBanner({
        kind: 'error',
        text: 'Please correct the highlighted fields before saving.',
      });
      // Move focus to the first problem so keyboard users are not stranded.
      const first = result.firstField;
      const el = formRef.current?.querySelector(`#${first}`);
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSaving(true);
    try {
      const saved = await createMember({
        memberId: String(values.memberId).trim(),
        fullName: String(values.fullName).trim(),
        designation: String(values.designation).trim(),
        state: String(values.state).trim(),
        district: String(values.district).trim(),
        photoUrl: values.photoUrl,
        photoFile: values.photoFile,
        validFrom: toISODate(values.validFrom),
        validUntil: toISODate(values.validUntil),
        status: values.status,
        revocationReason: values.revocationReason?.trim() || null,
      });
      navigate(`/members/${encodeURIComponent(saved.memberId)}?created=1`);
    } catch (err) {
      if (err?.code === 'DUPLICATE_ID') {
        setErrors({ memberId: 'That ID number is already assigned.' });
        setBanner({ kind: 'error', text: 'ID number already in use.' });
      } else {
        setBanner({
          kind: 'error',
          text: 'The member could not be saved. Please try again.',
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link
            to="/"
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: -12, marginBottom: 6 }}
          >
            <ArrowLeft size={15} />
            Back to dashboard
          </Link>
          <h1 className="h1">Add new member</h1>
          <p className="page-sub">
            Enter the member&rsquo;s details and upload a photograph. The ID card and QR
            code are generated automatically from the fixed template.
          </p>
        </div>
      </div>

      {banner ? (
        <div className={`banner banner-${banner.kind}`} role="alert">
          {banner.kind === 'ok'
            ? <CheckCircle2 size={17} />
            : <AlertCircle size={17} />}
          <span>{banner.text}</span>
        </div>
      ) : null}

      <div className="member-page">
        <form
          ref={formRef}
          className="member-form-col"
          onSubmit={handleSave}
          noValidate
        >
          <MemberForm
            values={values}
            onChange={setValues}
            errors={errors}
            disabled={saving}
          />

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={saving}
            >
              {saving
                ? <><span className="spinner" /> Saving&hellip;</>
                : <><Save size={17} /> Save member</>}
            </button>

            <button
              type="button"
              className="btn btn-red btn-lg"
              disabled={saving}
              onClick={() => {
                const result = validateMemberForm(values, knownIds);
                setErrors(result.errors);
                setBanner(
                  result.ok
                    ? {
                      kind: 'ok',
                      text: 'Details look good — use Save member to issue the card.',
                    }
                    : { kind: 'error', text: 'Please correct the highlighted fields first.' },
                );
              }}
            >
              <IdCard size={17} />
              Generate ID card
            </button>

            <Link to="/" className="btn btn-ghost btn-lg">Cancel</Link>
          </div>
        </form>

        <aside className="preview-col">
          <div className="preview-panel">
            <div className="preview-panel__head">
              <span className="preview-panel__title">Live preview</span>
              <span className="badge badge-neutral">Locked template</span>
            </div>

            <div className="preview-stage">
              <CardStage
                organization={organization}
                member={memberForCard}
                verifyUrl={
                  values.memberId && organization.qrEnabled
                    ? buildVerifyUrl(values.memberId)
                    : null
                }
              />
            </div>

            <div className="preview-panel__actions">
              <Link to="/dev/card" className="btn btn-secondary btn-sm">
                Open full-size preview
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h3 className="h3" style={{ marginBottom: 10 }}>What happens next</h3>
              <ul className="stack gap-2 text-sm text-muted">
                <li>Save the member to create a unique ID number.</li>
                <li>A QR code is generated for the verification link.</li>
                <li>Download the card as PNG or PDF, or print it.</li>
                <li>Anyone scanning the QR sees the live validity status.</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}