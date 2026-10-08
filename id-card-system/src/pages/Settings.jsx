import { useEffect, useRef, useState } from 'react';
import { Save, RotateCcw, Building2, Hash, QrCode, CheckCircle2, AlertCircle, Upload, Trash2 } from 'lucide-react';
import { getOrganization, saveOrganization, resetOrganization, listMembers } from '../services/localStore';
import { suggestNextId } from '../utils/idGenerator';
import CardStage from '../components/CardStage';
import '../styles/settings.css';

/**
 * Settings
 * ---------------------------------------------------------------------------
 * Organisation-level configuration, entered ONCE and applied to every card.
 *
 * This is deliberately NOT a card designer. There is no colour picker, no
 * template chooser and no way to move anything - the card layout is locked in
 * src/config/cardDesign.js and cannot be edited from here.
 */
export default function Settings() {
  const [values, setValues] = useState(() => getOrganization());
  const [banner, setBanner] = useState(null);
  const [saving, setSaving] = useState(false);
  const [nextId, setNextId] = useState('');
  const logoInput = useRef(null);

  useEffect(() => {
    let alive = true;
    // `values` is already seeded by the lazy initialiser above; only the
    // derived "next ID" needs to wait for the member list.
    listMembers()
      .then((rows) => {
        if (alive) setNextId(suggestNextId(getOrganization(), rows.map((r) => r.memberId)));
      })
      .catch(() => {});

    return () => { alive = false; };
  }, []);

  const set = (key) => (event) => {
    const { value, type, checked } = event.target;
    setValues((v) => ({ ...v, [key]: type === 'checkbox' ? checked : value }));
  };

  async function handleLogo(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !values) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setBanner({ kind: 'error', text: 'Logo must be a PNG, JPG or WebP image.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setBanner({ kind: 'error', text: 'Logo must be smaller than 2 MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setValues((v) => ({ ...v, logoUrl: reader.result }));
      setBanner(null);
    };
    reader.onerror = () => setBanner({ kind: 'error', text: 'That logo could not be read.' });
    reader.readAsDataURL(file);
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      saveOrganization({
        name: values.name.trim(),
        nameHi: values.nameHi?.trim() ?? '',
        registrationText: values.registrationText.trim(),
        isoText: values.isoText?.trim() ?? '',
        scopeText: values.scopeText.trim(),
        supportText: values.supportText.trim(),
        footerText: values.footerText.trim(),
        signatoryName: values.signatoryName.trim(),
        signatoryDesignation: values.signatoryDesignation.trim(),
        idPrefix: values.idPrefix.trim(),
        idStart: Number(values.idStart) || 1,
        idPadding: Number(values.idPadding) || 7,
        defaultValidityMonths: Number(values.defaultValidityMonths) || 12,
        qrEnabled: Boolean(values.qrEnabled),
        logoUrl: values.logoUrl,
        sealUrl: values.sealUrl,
      });
      setBanner({ kind: 'ok', text: 'Settings saved. New cards will use these values.' });
    } catch {
      setBanner({ kind: 'error', text: 'Settings could not be saved.' });
    } finally {
      setSaving(false);
    }
  }

  if (!values) return <div className="page"><div className="skeleton" style={{ height: 400 }} /></div>;

  const sample = {
    name: 'सदस्य का नाम',
    designation: 'पद',
    state: 'राज्य',
    memberId: nextId || '0000000',
    validUntil: '',
    photoUrl: null,
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h1">Settings</h1>
          <p className="page-sub">
            Organisation details entered once, applied to every card. The card layout
            itself is locked and cannot be changed here.
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

      <div className="settings-grid">
        <form className="stack gap-4" onSubmit={handleSave}>
          {/* ---- organisation ---- */}
          <section className="card">
            <div className="card-head">
              <h2 className="h3"><Building2 size={17} /> Organisation</h2>
            </div>
            <div className="card-body stack gap-4">
              <div className="logo-row">
                <div className="logo-preview">
                  {values.logoUrl
                    ? <img src={values.logoUrl} alt="Organisation logo" />
                    : <span className="logo-preview-empty">No logo</span>}
                </div>
                <div className="stack gap-2">
                  <input
                    ref={logoInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogo}
                    className="visually-hidden"
                  />
                  <div className="row gap-2 wrap">
                    <button type="button" className="btn btn-secondary btn-sm"
                      onClick={() => logoInput.current?.click()}>
                      <Upload size={15} /> Upload logo
                    </button>
                    {values.logoUrl ? (
                      <button type="button" className="btn btn-danger-ghost btn-sm"
                        onClick={() => setValues((v) => ({ ...v, logoUrl: null }))}>
                        <Trash2 size={15} /> Remove
                      </button>
                    ) : null}
                  </div>
                  <span className="field-hint">Transparent PNG works best · max 2 MB</span>
                </div>
              </div>

              <div className="form-grid">
                <div className="field span-2">
                  <label className="label" htmlFor="s-name">Organisation name (header)</label>
                  <input id="s-name" className="input" value={values.name} onChange={set('name')} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="s-namehi">Second heading (optional)</label>
                  <input id="s-namehi" className="input" value={values.nameHi ?? ''} onChange={set('nameHi')} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="s-iso">Certification badge (optional)</label>
                  <input id="s-iso" className="input" value={values.isoText ?? ''} onChange={set('isoText')} />
                  <span className="field-hint">Leave empty to hide the badge.</span>
                </div>

                <div className="field span-2">
                  <label className="label" htmlFor="s-reg">Registration line (under header)</label>
                  <input id="s-reg" className="input" value={values.registrationText} onChange={set('registrationText')} />
                </div>
                <div className="field span-2">
                  <label className="label" htmlFor="s-scope">Small line under the validity date</label>
                  <input id="s-scope" className="input" value={values.scopeText} onChange={set('scopeText')} />
                </div>
                <div className="field span-2">
                  <label className="label" htmlFor="s-support">Objective / supporting band</label>
                  <input id="s-support" className="input" value={values.supportText} onChange={set('supportText')} />
                </div>
                <div className="field span-2">
                  <label className="label" htmlFor="s-footer">Footer (press Enter for a new line)</label>
                  <textarea id="s-footer" className="textarea" rows={2} value={values.footerText}
                    onChange={set('footerText')} />
                </div>
              </div>
            </div>
          </section>

          {/* ---- signatory ---- */}
          <section className="card">
            <div className="card-head"><h2 className="h3">Authorised signatory</h2></div>
            <div className="card-body">
              <div className="form-grid">
                <div className="field">
                  <label className="label" htmlFor="s-signame">Signatory name</label>
                  <input id="s-signame" className="input" value={values.signatoryName} onChange={set('signatoryName')} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="s-sigrole">Signatory designation</label>
                  <input id="s-sigrole" className="input" value={values.signatoryDesignation} onChange={set('signatoryDesignation')} />
                </div>
              </div>
            </div>
          </section>

          {/* ---- ID configuration ---- */}
          <section className="card">
            <div className="card-head"><h2 className="h3"><Hash size={17} /> ID configuration</h2></div>
            <div className="card-body">
              <div className="form-grid">
                <div className="field">
                  <label className="label" htmlFor="s-prefix">ID prefix</label>
                  <input id="s-prefix" className="input text-mono" value={values.idPrefix}
                    onChange={set('idPrefix')} placeholder="none" />
                </div>
                <div className="field">
                  <label className="label" htmlFor="s-start">Starting number</label>
                  <input id="s-start" type="number" className="input text-mono" value={values.idStart}
                    onChange={set('idStart')} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="s-pad">Digits (padding)</label>
                  <input id="s-pad" type="number" min="3" max="12" className="input text-mono"
                    value={values.idPadding} onChange={set('idPadding')} />
                  <span className="field-hint">Next ID would be <strong>{nextId}</strong></span>
                </div>
                <div className="field">
                  <label className="label" htmlFor="s-validity">Default validity (months)</label>
                  <input id="s-validity" type="number" min="1" max="120" className="input"
                    value={values.defaultValidityMonths} onChange={set('defaultValidityMonths')} />
                </div>
                <div className="field span-2">
                  <label className="check">
                    <input type="checkbox" checked={Boolean(values.qrEnabled)} onChange={set('qrEnabled')} />
                    <QrCode size={15} /> Print a QR code on every card
                  </label>
                </div>
              </div>
            </div>
          </section>

          <div className="row gap-3 wrap">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Saving&hellip;</> : <><Save size={16} /> Save settings</>}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (!window.confirm('Reset all organisation settings back to defaults?')) return;
                setValues(resetOrganization());
                setBanner({ kind: 'ok', text: 'Settings reset to defaults.' });
              }}
            >
              <RotateCcw size={16} /> Reset to defaults
            </button>
          </div>
        </form>

        {/* ---- preview ---- */}
        <aside className="settings-preview">
          <div className="preview-panel">
            <div className="preview-panel__head">
              <span className="preview-panel__title">Preview</span>
              <span className="badge badge-neutral">Live</span>
            </div>
            <div className="preview-stage">
              <CardStage organization={values} member={sample} />
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <p className="field-hint">
                Everything above is fixed organisation content. It is identical on
                every card and cannot be varied per member.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}