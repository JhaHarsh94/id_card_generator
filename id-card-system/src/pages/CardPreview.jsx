import { useRef, useState } from 'react';
import CardStage from '../components/CardStage';
import organizationDefaults from '../config/organization.default';
import samplePortrait from '../assets/samples/member-portrait-ai.png';
import { downloadCardPng, downloadCardPdf, printCard } from '../utils/cardExport';
import '../styles/card-preview.css';

/** Local-only artwork review. This route is omitted from production. */
export default function CardPreview() {
  const cardRef = useRef(null);
  const [member, setMember] = useState({
    name: 'सदस्य का नाम', designation: 'सदस्य', state: 'उत्तर प्रदेश',
    district: 'मेरठ', memberId: 'PKSDST0001', validUntil: '2027-10-18', photoUrl: samplePortrait,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function exportCard(kind) {
    setBusy(true);
    setError('');
    try {
      if (kind === 'png') await downloadCardPng(cardRef.current, member);
      if (kind === 'pdf') await downloadCardPdf(cardRef.current, member);
      if (kind === 'print') await printCard(cardRef.current, member, { organization: organizationDefaults });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="card-preview">
      <h1>Membership Card Preview</h1>
      <CardStage cardRef={cardRef} organization={organizationDefaults} member={member} />
      <p className="card-preview__hint">Print करते समय A4, Landscape और Background graphics ON रखें।</p>
      <p className="card-preview__hint">Sample portrait: AI-generated fictional person.</p>
      <div className="card-preview__controls">
        {[
          ['name', 'Name'], ['designation', 'Designation'], ['state', 'State'],
          ['district', 'District'], ['memberId', 'ID number'], ['validUntil', 'Valid until'],
        ].map(([key, label]) => (
          <label key={key}>{label}
            <input className="input" type={key === 'validUntil' ? 'date' : 'text'}
              value={member[key]} onChange={(event) => setMember((prev) => ({ ...prev, [key]: event.target.value }))} />
          </label>
        ))}
        <label>Member photo
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setMember((prev) => ({ ...prev, photoUrl: reader.result }));
            reader.readAsDataURL(file);
          }} />
        </label>
      </div>
      <div className="card-preview__actions">
        {['png', 'pdf', 'print'].map((kind) => (
          <button key={kind} className="btn btn-primary" disabled={busy} onClick={() => exportCard(kind)}>
            {kind === 'print' ? 'Print card' : `Download ${kind.toUpperCase()}`}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
