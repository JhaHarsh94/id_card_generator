import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus, Download, FileText, Printer, Share2, Trash2, Copy, Check, AlertCircle,
} from 'lucide-react';
import CardStage from '../components/CardStage';
import { getOrganization, createMember, existingMemberIds } from '../services/localStore';
import { validateMemberForm, validateImageFile, checkImageDimensions } from '../utils/validation';
import { compressImage, readAsDataUrl, readSize, formatBytes } from '../utils/imageProcessing';
import { addMonths, toISODate, today } from '../utils/date';
import { suggestNextId } from '../utils/idGenerator';
import { buildVerifyUrl } from '../utils/verification';
import { downloadCardPng, downloadCardPdf, printCard, shareCard } from '../utils/cardExport';
import '../styles/simple.css';

/**
 * SimplePage — the default landing page.
 * ---------------------------------------------------------------------------
 * Deliberately a single screen: fill the form, watch the card appear, then
 * download, print or share it. No dashboard, no menus, no login.
 *
 * The full admin area still exists at /admin.
 */
export default function SimplePage() {
  const organization = getOrganization();
  const fileRef = useRef(null);
  const cardRef = useRef(null);

  const [values, setValues] = useState(() => ({
    fullName: '',
    designation: '',
    state: '',
    district: '',
    photoUrl: null,
    photoFile: null,
    validUntil: toISODate(addMonths(today(), organization.defaultValidityMonths ?? 12)),
    memberId: '',
  }));

  const [errors, setErrors] = useState({});
  const [photoError, setPhotoError] = useState('');
  const [photoSaved, setPhotoSaved] = useState(null);
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState(false);

  // Pre-fill the next ID number.
  useEffect(() => {
    setValues((v) => (v.memberId ? v : {
      ...v,
      memberId: suggestNextId(organization, existingMemberIds()),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const ready = String(values.fullName ?? '').trim().length > 0;

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setPhotoError('');
    setPhotoSaved(null);
    const check = validateImageFile(file);
    if (!check.ok) { setPhotoError(check.message); return; }

    try {
      const raw = await readAsDataUrl(file);
      const { width, height } = await readSize(raw);
      const dims = checkImageDimensions(width, height);
      if (!dims.ok) { setPhotoError(dims.message); return; }

      // Downscale before storing - a raw phone photo is ~1.4 MB as base64 and
      // localStorage only holds ~5 MB in total.
      const { dataUrl, bytes } = await compressImage(raw);
      setValues((v) => ({ ...v, photoUrl: dataUrl, photoFile: file }));
      setPhotoSaved(bytes);
    } catch {
      setPhotoError('That photo could not be read.');
    }
  }

  /** Persist so the member appears in the admin area and the verify page. */
  async function handleSave() {
    const result = validateMemberForm(values, existingMemberIds());
    setErrors(result.errors);
    if (!result.ok) {
      setNotice('Please fill in the name, designation, state and valid-up-to date.');
      return;
    }
    setBusy('save');
    try {
      const record = await createMember({
        memberId: String(values.memberId).trim(),
        fullName: String(values.fullName).trim(),
        designation: String(values.designation).trim(),
        state: String(values.state).trim(),
        district: String(values.district).trim(),
        photoUrl: values.photoUrl,
        photoFile: values.photoFile,
        validFrom: toISODate(today()),
        validUntil: toISODate(values.validUntil),
        status: 'active',
        revocationReason: null,
      });
      setSaved(record.memberId);
      setNotice('ID card created. You can now download, print or share it.');
    } catch {
      setNotice('Could not create the card. Please try again.');
    } finally {
      setBusy('');
    }
  }

  function handleReset() {
    setValues({
      fullName: '', designation: '', state: '', district: '',
      photoUrl: null, photoFile: null,
      validUntil: toISODate(addMonths(today(), organization.defaultValidityMonths ?? 12)),
      memberId: suggestNextId(organization, existingMemberIds()),
    });
    setErrors({});
    setPhotoError('');
    setPhotoSaved(null);
    setSaved(null);
    setNotice('');
    setCopied(false);
  }

  async function runExport(kind) {
    if (!cardRef.current || busy) return;
    setBusy(kind);
    try {
      if (kind === 'png') await downloadCardPng(cardRef.current, values);
      else if (kind === 'pdf') await downloadCardPdf(cardRef.current, values);
      else if (kind === 'print') await printCard(cardRef.current, values, { organization });
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy('');
    }
  }

  async function handleShare() {
    if (!cardRef.current || busy) return;
    setBusy('share');
    try {
      const result = await shareCard(cardRef.current, values, {
        verifyUrl: saved ? buildVerifyUrl(saved) : null,
        organization,
        // Share sheet unavailable — offer the image file plus the link instead.
        fallback: async ({ dataUrl, verifyUrl }) => {
          if (dataUrl) {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `${values.memberId || 'id-card'}.png`;
            link.click();
          }
          if (verifyUrl) {
            try { await navigator.clipboard.writeText(verifyUrl); setCopied(true); } catch { /* ignore */ }
          }
          setNotice(
            verifyUrl
              ? 'Card image downloaded and the verification link copied to your clipboard.'
              : 'Card image downloaded.',
          );
        },
      });
      if (result === 'shared') setNotice('Card shared.');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy('');
    }
  }

  async function copyLink() {
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(buildVerifyUrl(saved));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice('Could not copy the link.');
    }
  }

  return (
    <div className="simple">
      {/* ---- header ---- */}
      <header className="simple__top">
        <div className="simple__brand">
          {organization.logoUrl ? <img src={organization.logoUrl} alt="" /> : null}
          <span>
            <span className="simple__org">{organization.name}</span>
            <span className="simple__org-sub">ID Card</span>
          </span>
        </div>
      </header>

      <main className="simple__main">
        <h1 className="simple__title">ID Card बनाएं</h1>
        <p className="simple__sub">
          नीचे भरें — कार्ड तुरंत बन जाएगा। फिर डाउनलोड करें या साझा करें।
        </p>

        {notice ? (
          <div className={`banner banner-${saved ? 'ok' : 'warn'}`} role="status">
            {saved ? <Check size={17} /> : <AlertCircle size={17} />}
            <span>{notice}</span>
          </div>
        ) : null}

        <div className="simple__grid">
          {/* ---- form ---- */}
          <section className="simple__card">
            <h2 className="simple__card-title">
              <UserPlus size={17} /> सदस्य की जानकारी
            </h2>

            <div className="simple__fields">
              <div className="field">
                <label className="label" htmlFor="s-fullName">नाम<span className="req">*</span></label>
                <input id="s-fullName" className="input" value={values.fullName}
                  onChange={set('fullName')} placeholder="सुनीता देवी"
                  aria-invalid={Boolean(errors.fullName)} autoComplete="off" />
              </div>

              <div className="field">
                <label className="label" htmlFor="s-designation">पद<span className="req">*</span></label>
                <input id="s-designation" className="input" value={values.designation}
                  onChange={set('designation')} placeholder="प्रधान जिला अध्यक्ष"
                  aria-invalid={Boolean(errors.designation)} autoComplete="off" />
              </div>

              <div className="field">
                <label className="label" htmlFor="s-state">राज्य<span className="req">*</span></label>
                <input id="s-state" className="input" value={values.state}
                  onChange={set('state')} placeholder="उत्तर प्रदेश"
                  list="simple-states" aria-invalid={Boolean(errors.state)} autoComplete="off" />
                <datalist id="simple-states">
                  <option value="उत्तर प्रदेश" /><option value="राजस्थान" />
                  <option value="मध्य प्रदेश" /><option value="बिहार" />
                  <option value="हरियाणा" /><option value="दिल्ली" />
                </datalist>
              </div>

              <div className="field">
                <label className="label" htmlFor="s-district">जिला</label>
                <input id="s-district" className="input" value={values.district}
                  onChange={set('district')} placeholder="बागपत" autoComplete="off" />
              </div>

              <div className="field">
                <label className="label" htmlFor="s-memberId">ID No.</label>
                <input id="s-memberId" className="input text-mono" value={values.memberId}
                  onChange={set('memberId')} autoComplete="off" spellCheck={false} />
              </div>

              <div className="field">
                <label className="label" htmlFor="s-validUntil">
                  कब तक valid<span className="req">*</span>
                </label>
                <input id="s-validUntil" type="date" className="input" value={values.validUntil}
                  onChange={set('validUntil')} aria-invalid={Boolean(errors.validUntil)} />
              </div>

              {/* ---- photo ---- */}
              <div className="field simple__photo">
                <label className="label">फोटो</label>
                <div className="simple__photo-row">
                  <div className="simple__photo-preview">
                    {values.photoUrl
                      ? <img src={values.photoUrl} alt="" />
                      : <span>फोटो</span>}
                  </div>
                  <div className="stack gap-2 grow">
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhoto} className="visually-hidden" />
                    <div className="row gap-2 wrap">
                      <button type="button" className="btn btn-secondary btn-sm"
                        onClick={() => fileRef.current?.click()}>
                        {values.photoUrl ? 'बदलें' : 'फोटो चुनें'}
                      </button>
                      {values.photoUrl ? (
                        <button type="button" className="btn btn-danger-ghost btn-sm"
                          onClick={() => setValues((v) => ({ ...v, photoUrl: null, photoFile: null }))}>
                          <Trash2 size={14} /> हटाएं
                        </button>
                      ) : null}
                    </div>
                    {photoError ? (
                      <span className="field-error"><AlertCircle size={13} />{photoError}</span>
                    ) : photoSaved ? (
                      <span className="field-hint">फोटो तैयार · {formatBytes(photoSaved)}</span>
                    ) : (
                      <span className="field-hint">JPG / PNG · 5 MB तक</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="simple__actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={handleSave} disabled={!!busy}>
                {busy === 'save' ? <><span className="spinner" /> बना रहे…</> : 'ID कार्ड बनाएं'}
              </button>
              <button type="button" className="btn btn-ghost btn-lg" onClick={handleReset} disabled={!!busy}>
                <Trash2 size={16} /> साफ़ करें
              </button>
            </div>
          </section>

          {/* ---- card + actions ---- */}
          <section className="simple__card">
            <h2 className="simple__card-title">कार्ड</h2>

            <div className="simple__preview">
              <CardStage
                organization={organization}
                cardRef={cardRef}
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

            <div className="simple__buttons">
              <button type="button" className="btn btn-primary" onClick={() => runExport('png')}
                disabled={!ready || !!busy}>
                {busy === 'png' ? <span className="spinner" /> : <Download size={16} />} Download PNG
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => runExport('pdf')}
                disabled={!ready || !!busy}>
                {busy === 'pdf' ? <span className="spinner" /> : <FileText size={16} />} PDF
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => runExport('print')}
                disabled={!ready || !!busy}>
                {busy === 'print' ? <span className="spinner" /> : <Printer size={16} />} Print
              </button>
              <button type="button" className="btn btn-red" onClick={handleShare} disabled={!ready || !!busy}>
                {busy === 'share' ? <span className="spinner" /> : <Share2 size={16} />} Share
              </button>
            </div>

            {saved ? (
              <div className="simple__verify">
                <span className="simple__verify-label">QR scan करने पर खुलेगा</span>
                <div className="row gap-2">
                  <input className="input text-mono text-sm" readOnly value={buildVerifyUrl(saved)} />
                  <button type="button" className="btn btn-secondary btn-icon"
                    onClick={copyLink} aria-label="Copy link">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>

      <footer className="simple__foot">
        <Link to="/admin">Admin</Link>
      </footer>
    </div>
  );
}