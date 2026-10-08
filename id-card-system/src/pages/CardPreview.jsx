import { useState } from 'react';
import IDCardTemplate from '../components/IDCard/IDCardTemplate';
import organizationDefaults from '../config/organization.default';
import { CARD } from '../config/cardDesign';
import { formatDate, addMonths, today } from '../utils/date';

/**
 * Development-only preview of the locked card template, with live controls.
 * Route: /dev/card  (not linked from the admin sidebar)
 *
 * This exists so the card design can be reviewed against the reference without
 * a database or a login.
 */
export default function CardPreview() {
  const [scale, setScale] = useState(0.62);
  const [name, setName] = useState('M.K Kabira');
  const [designation, setDesignation] = useState('State President');
  const [state, setState] = useState('Uttar Pradesh');
  const [memberId, setMemberId] = useState('0095030');

  const validUntil = formatDate(addMonths(today(), 11));

  const member = {
    name,
    designation,
    state,
    memberId,
    validUntil,
    photoUrl: null,
  };

  return (
    <div style={{ padding: 28, minHeight: '100vh', background: '#f4f6fb' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Card template preview</h1>
      <p style={{ color: '#5a6285', fontSize: 13, marginBottom: 20 }}>
        Development preview · locked design · {CARD.width}×{CARD.height}px canvas
        (CR80 {CARD.widthMM}×{CARD.heightMM}mm)
      </p>

      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {[
          ['Name', name, setName],
          ['Designation', designation, setDesignation],
          ['State', state, setState],
          ['ID', memberId, setMemberId],
        ].map(([label, value, setter]) => (
          <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#5a6285' }}>{label}</span>
            <input
              className="input"
              style={{ width: 190 }}
              value={value}
              onChange={(e) => setter(e.target.value)}
            />
          </label>
        ))}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#5a6285' }}>
            Zoom {Math.round(scale * 100)}%
          </span>
          <input
            type="range"
            min="0.3"
            max="1"
            step="0.01"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            style={{ width: 150 }}
          />
        </label>
      </div>

      <div
        style={{
          display: 'inline-block',
          width: CARD.width * scale,
          height: CARD.height * scale,
          overflow: 'hidden',
          borderRadius: 10,
          boxShadow: '0 24px 56px rgba(16,19,42,.16)',
        }}
      >
        <div
          className="idcard-scale"
          style={{ transform: `scale(${scale})` }}
        >
          <IDCardTemplate organization={organizationDefaults} member={member} />
        </div>
      </div>
    </div>
  );
}