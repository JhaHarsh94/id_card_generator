import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, IdCard, AlertCircle } from 'lucide-react';
import MemberForm from '../components/MemberForm';
import CardStage from '../components/CardStage';
import { getMember, updateMember, getOrganization, existingMemberIds } from '../services/localStore';
import { validateMemberForm } from '../utils/validation';
import { toISODate } from '../utils/date';
import { buildVerifyUrl } from '../utils/verification';
import '../styles/details.css';

/**
 * EditMember
 * ---------------------------------------------------------------------------
 * Same form and same locked card as Add Member, pre-filled from the record.
 * The live preview updates while editing so changes are visible before saving.
 */
export default function EditMember() {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const formRef = useRef(null);

  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const organization = getOrganization();

  useEffect(() => {
    let alive = true;
    getMember(decodeURIComponent(memberId))
      .then((row) => {
        if (!alive) return;
        if (!row) {
          setNotFound(true);
          return;
        }
        setValues({
          fullName: row.fullName ?? '',
          memberId: row.memberId ?? '',
          designation: row.designation ?? '',
          state: row.state ?? '',
          district: row.district ?? '',
          photoUrl: row.photoUrl ?? null,
          photoFile: null,
          validFrom: toISODate(row.validFrom) ?? '',
          validUntil: toISODate(row.validUntil) ?? '',
          status: row.status ?? 'active',
          revocationReason: row.revocationReason ?? '',
        });
      })
      .catch(() => alive && setNotFound(true));
    return () => { alive = false; };
  }, [memberId]);

  async function handleSave(event) {
    event.preventDefault();
    if (saving || !values) return;

    setBanner(null);
    // Exclude this member's own ID so re-saving an unchanged number is allowed.
    const known = existingMemberIds().filter((id) => id !== values.memberId);
    const result = validateMemberForm(values, known);
    setErrors(result.errors);

    if (!result.ok) {
      setBanner({ kind: 'error', text: 'Please correct the highlighted fields before saving.' });
      const el = formRef.current?.querySelector(`#${result.firstField}`);
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSaving(true);
    try {
      await updateMember(
        (await getMember(decodeURIComponent(memberId))).id,
        {
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
        },
      );
      navigate(`/members/${encodeURIComponent(values.memberId.trim())}?saved=1`);
    } catch (err) {
      setBanner({
        kind: 'error',
        text: err?.code === 'DUPLICATE_ID'
          ? 'That ID number is already assigned to another member.'
          : 'The changes could not be saved. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <div className="page">
        <div className="error-state">
          <span className="icon-ring"><AlertCircle size={24} /></span>
          <p className="h3">Member not found</p>
          <Link to="/members" className="btn btn-primary">Back to members</Link>
        </div>
      </div>
    );
  }

  if (!values) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 40, width: 220 }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link
            to={`/members/${encodeURIComponent(values.memberId)}`}
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: -12, marginBottom: 6 }}
          >
            <ArrowLeft size={15} /> Back to member
          </Link>
          <h1 className="h1">Edit member</h1>
          <p className="page-sub">
            Changes are reflected in the live preview and the QR link updates with
            the ID number.
          </p>
        </div>
      </div>

      {banner ? (
        <div className={`banner banner-${banner.kind}`} role="alert">
          <AlertCircle size={17} />
          <span>{banner.text}</span>
        </div>
      ) : null}

      <div className="member-page">
        <form ref={formRef} className="member-form-col" onSubmit={handleSave} noValidate>
          <MemberForm
            values={values}
            onChange={setValues}
            errors={errors}
            disabled={saving}
          />

          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? <><span className="spinner" /> Saving&hellip;</> : <><Save size={17} /> Save changes</>}
            </button>
            <button type="button" className="btn btn-red btn-lg" disabled={saving}
              onClick={() => {
                const known = existingMemberIds().filter((id) => id !== values.memberId);
                const result = validateMemberForm(values, known);
                setErrors(result.errors);
                setBanner(result.ok
                  ? { kind: 'ok', text: 'Details look good — save to apply them.' }
                  : { kind: 'error', text: 'Please correct the highlighted fields first.' });
              }}
            >
              <IdCard size={17} /> Check card
            </button>
            <Link to={`/members/${encodeURIComponent(values.memberId)}`} className="btn btn-ghost btn-lg">Cancel</Link>
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
                member={{
                  name: values.fullName,
                  designation: values.designation,
                  state: values.state,
                  memberId: values.memberId,
                  validUntil: values.validUntil,
                  photoUrl: values.photoUrl,
                }}
                verifyUrl={values.memberId ? buildVerifyUrl(values.memberId) : null}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}