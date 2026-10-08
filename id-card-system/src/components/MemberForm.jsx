import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, UserRound, AlertCircle } from 'lucide-react';
import {
  validateImageFile,
  readFileAsDataUrl,
  readImageSize,
  checkImageDimensions,
  IMAGE_RULES,
} from '../utils/validation';
import { STATUS_OPTIONS, STATUS } from '../utils/status';
import './MemberForm.css';

/**
 * MemberForm
 * ---------------------------------------------------------------------------
 * Everything the administrator is allowed to change, nothing more. The card
 * design is fixed, so there is no colour picker, no template chooser and no
 * layout controls here by design.
 *
 * Photo handling keeps a local object URL for instant preview and surfaces
 * validation failures inline instead of throwing.
 */
export default function MemberForm({
  values,
  onChange,
  errors = {},
  disabled = false,
  showStatusField = true,
}) {
  const inputRef = useRef(null);
  const [photoError, setPhotoError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);

  const set = (key) => (event) => {
    const { value } = event.target;
    onChange({ ...values, [key]: value });
  };

  // ---- photo ------------------------------------------------------------

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    // Allow re-selecting the same file after a failure.
    event.target.value = '';
    if (!file) return;

    setPhotoError('');

    const check = validateImageFile(file);
    if (!check.ok) {
      setPhotoError(check.message);
      return;
    }

    setPhotoBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const { width, height } = await readImageSize(dataUrl);

      const dims = checkImageDimensions(width, height);
      if (!dims.ok) {
        setPhotoError(dims.message);
        return;
      }

      onChange({ ...values, photoUrl: dataUrl, photoFile: file });
    } catch {
      setPhotoError('That photo could not be read. Try a different file.');
    } finally {
      setPhotoBusy(false);
    }
  }

  function clearPhoto() {
    setPhotoError('');
    onChange({ ...values, photoUrl: null, photoFile: null });
  }

  // Warn before losing unsaved photo work when leaving the page.
  useEffect(() => {
    if (!values.photoFile) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [values.photoFile]);

  const photoErrorText = photoError || errors.photoUrl;

  return (
    <div className="memberform">
      {/* ================= PERSONAL INFORMATION ================= */}
      <section className="card">
        <div className="card-head">
          <h2 className="h3">Personal information</h2>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="field span-2">
              <label className="label" htmlFor="fullName">
                Full name<span className="req">*</span>
              </label>
              <input
                id="fullName"
                className="input"
                value={values.fullName ?? ''}
                onChange={set('fullName')}
                placeholder="e.g. सुनीता देवी"
                aria-invalid={Boolean(errors.fullName)}
                disabled={disabled}
                autoComplete="off"
              />
              {errors.fullName ? (
                <span className="field-error"><AlertCircle size={13} />{errors.fullName}</span>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="designation">
                Designation<span className="req">*</span>
              </label>
              <input
                id="designation"
                className="input"
                value={values.designation ?? ''}
                onChange={set('designation')}
                placeholder="e.g. प्रधान जिला अध्यक्ष"
                aria-invalid={Boolean(errors.designation)}
                disabled={disabled}
                autoComplete="off"
              />
              {errors.designation ? (
                <span className="field-error"><AlertCircle size={13} />{errors.designation}</span>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="state">
                State<span className="req">*</span>
              </label>
              <input
                id="state"
                className="input"
                value={values.state ?? ''}
                onChange={set('state')}
                placeholder="e.g. उत्तर प्रदेश"
                aria-invalid={Boolean(errors.state)}
                disabled={disabled}
                list="state-options"
                autoComplete="off"
              />
              <datalist id="state-options">
                <option value="उत्तर प्रदेश" />
                <option value="राजस्थान" />
                <option value="मध्य प्रदेश" />
                <option value="बिहार" />
                <option value="हरियाणा" />
                <option value="दिल्ली" />
                <option value="उत्तराखंड" />
              </datalist>
              {errors.state ? (
                <span className="field-error"><AlertCircle size={13} />{errors.state}</span>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="district">
                District
              </label>
              <input
                id="district"
                className="input"
                value={values.district ?? ''}
                onChange={set('district')}
                placeholder="e.g. बागपत"
                aria-invalid={Boolean(errors.district)}
                disabled={disabled}
                autoComplete="off"
              />
              {errors.district ? (
                <span className="field-error"><AlertCircle size={13} />{errors.district}</span>
              ) : (
                <span className="field-hint">
                  Not shown on the card, but searchable from the members list.
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================= ID INFORMATION ================= */}
      <section className="card">
        <div className="card-head">
          <h2 className="h3">ID information</h2>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="field">
              <label className="label" htmlFor="memberId">
                Member ID<span className="req">*</span>
              </label>
              <input
                id="memberId"
                className="input text-mono"
                value={values.memberId ?? ''}
                onChange={set('memberId')}
                placeholder="e.g. 0095030"
                aria-invalid={Boolean(errors.memberId)}
                disabled={disabled || !values.memberIdEditable}
                autoComplete="off"
                spellCheck={false}
              />
              {errors.memberId ? (
                <span className="field-error"><AlertCircle size={13} />{errors.memberId}</span>
              ) : (
                <span className="field-hint">
                  Printed as “ID No.{values.memberId}” on the card and used as the
                  verification link.
                </span>
              )}
            </div>

            <div className="field">
              {showStatusField ? (
                <>
                  <label className="label" htmlFor="status">Status</label>
                  <select
                    id="status"
                    className="select"
                    value={values.status ?? STATUS.ACTIVE}
                    onChange={set('status')}
                    disabled={disabled}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <span className="field-hint">
                    Expired is calculated automatically from the dates. Revoked is a
                    manual decision.
                  </span>
                </>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="validFrom">Valid from</label>
              <input
                id="validFrom"
                type="date"
                className="input"
                value={values.validFrom ?? ''}
                onChange={set('validFrom')}
                disabled={disabled}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="validUntil">
                Valid up to<span className="req">*</span>
              </label>
              <input
                id="validUntil"
                type="date"
                className="input"
                value={values.validUntil ?? ''}
                onChange={set('validUntil')}
                aria-invalid={Boolean(errors.validUntil)}
                disabled={disabled}
              />
              {errors.validUntil ? (
                <span className="field-error"><AlertCircle size={13} />{errors.validUntil}</span>
              ) : null}
            </div>

            {values.status === STATUS.REVOKED ? (
              <div className="field span-2">
                <label className="label" htmlFor="revocationReason">
                  Reason for revocation<span className="req">*</span>
                </label>
                <textarea
                  id="revocationReason"
                  className="textarea"
                  value={values.revocationReason ?? ''}
                  onChange={set('revocationReason')}
                  placeholder="e.g. Membership withdrawn on request"
                  aria-invalid={Boolean(errors.revocationReason)}
                  disabled={disabled}
                />
                {errors.revocationReason ? (
                  <span className="field-error">
                    <AlertCircle size={13} />{errors.revocationReason}
                  </span>
                ) : (
                  <span className="field-hint">
                    Kept for your records. It is not shown on the public verification page.
                  </span>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ================= PHOTO ================= */}
      <section className="card">
        <div className="card-head">
          <h2 className="h3">Member photograph</h2>
        </div>
        <div className="card-body">
          <div className="photo-row">
            <div className="photo-preview">
              {values.photoUrl ? (
                <img src={values.photoUrl} alt="Member photograph preview" />
              ) : (
                <span className="photo-preview-empty">
                  <UserRound size={30} strokeWidth={1.5} />
                </span>
              )}
              {photoBusy ? (
                <span className="photo-preview-busy"><span className="spinner" /></span>
              ) : null}
            </div>

            <div className="photo-actions">
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhoto}
                className="visually-hidden"
                disabled={disabled}
              />

              <div className="row gap-2 wrap">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={disabled || photoBusy}
                >
                  <Upload size={15} />
                  {values.photoUrl ? 'Replace photo' : 'Upload photo'}
                </button>

                {values.photoUrl ? (
                  <button
                    type="button"
                    className="btn btn-danger-ghost btn-sm"
                    onClick={clearPhoto}
                    disabled={disabled}
                  >
                    <Trash2 size={15} />
                    Remove
                  </button>
                ) : null}
              </div>

              <p className="field-hint">
                JPG, PNG or WebP · up to 5 MB · at least {IMAGE_RULES.minSide}px on the
                shorter side. The photo is cropped to the card frame — it is never
                stretched.
              </p>

              {photoErrorText ? (
                <span className="field-error"><AlertCircle size={13} />{photoErrorText}</span>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}