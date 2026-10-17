/**
 * HOME / LANDING PAGE
 * ---------------------------------------------------------------------------
 * The organisation's front door.
 *
 * It used to be that the card form was the first thing a visitor saw - no
 * context, no identity, just fields. This page states who the organisation is,
 * what it works for, where it is, and offers the two actions a visitor can
 * actually take:
 *
 *   1. "ID Card Banayein"  -> the card generator
 *   2. "Card Jaanchein"    -> the public verification lookup
 *
 * Admin access is a plain footer link, deliberately unadvertised. Making it
 * prominent invites people to poke at the admin panel.
 *
 * Every piece of copy is read from the organisation config (Settings), so the
 * page re-states itself if the client edits its own details - nothing here is
 * hardcoded organisation data.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrganization } from '../services/members';
import '../styles/home.css';

export default function Home() {
  const org = getOrganization();
  const navigate = useNavigate();
  const [lookup, setLookup] = useState('');

  /**
   * The address block is written by the client as free text with newlines. The
   * first line is the head office and any line beginning with "संपर्क" is the
   * contact list, so they are split apart here to land in separate cards.
   */
  const footerLines = String(org.footerText ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const addressLines = footerLines.filter((l) => !/^संपर्क/.test(l));
  const contactLine = footerLines.find((l) => /^संपर्क/.test(l)) ?? '';

  const submitLookup = (event) => {
    event.preventDefault();
    const id = String(lookup).trim().replace(/[^A-Za-z0-9-]/g, '');
    if (id) navigate(`/verify/${encodeURIComponent(id)}`);
  };

  return (
    <div className="home">
      {/* ================= TOP BAR ================= */}
      <header className="home__bar">
        <div className="home__bar-inner">
          <div className="home__brand">
            {org.logoUrl ? <img className="home__brand-logo" src={org.logoUrl} alt="" /> : null}
            <div>
              {org.name ? <p className="home__brand-name">{org.name}</p> : null}
              {org.trustNameEn ? <p className="home__brand-name-en">{org.trustNameEn}</p> : null}
            </div>
          </div>
          <a className="home__bar-link" href="/login">कार्यकर्ता लॉगिन</a>
        </div>
      </header>

      {/* ================= HERO ================= */}
      <section className="home__hero">
        <div className="home__hero-inner">
          <p className="home__eyebrow">
            {org.registrationText ? `${org.registrationText} ${org.registrationValue}` : 'पंजीकरण सं०'}
          </p>
          <h1 className="home__title">{org.name || org.trustNameEn}</h1>
          <p className="home__title-en">{org.trustNameEn}</p>
          {org.authorityText ? <p className="home__authority">{org.authorityText}</p> : null}

          <p className="home__lede">
            सदस्यता आई.डी. कार्ड यहाँ बनें — तुरंत डाउनलोड, प्रिंट और साझा करें।
            कार्ड पर बना क्यूआर कोड किसी भी फोन से स्कैन होकर सदस्यता सत्यापित करता है।
          </p>

          <div className="home__cta">
            <button type="button" className="home__btn home__btn--primary" onClick={() => navigate('/generate')}>
              आई.डी. कार्ड बनाएँ
            </button>
            <a className="home__btn home__btn--ghost" href="#verify">कार्ड जाँचें</a>
          </div>

          <p className="home__scope">
            {org.scopeText ? `${org.scopeText} · ` : ''}
            {org.signatoryDesignation || ''} {org.signatoryName || ''}
          </p>
        </div>
      </section>

      {/* ================= VERIFY ================= */}
      <section className="home__section home__section--verify" id="verify">
        <div className="home__wrap home__verify">
          <h2 className="home__h2">कार्ड सत्यापित करें</h2>
          <p className="home__note">
            कार्ड पर छपा क्रमांक डालें — क्या वह असली है या समाप्त, एक ही क्लिक में पता चल जाएगा।
          </p>
          <form className="home__lookup" onSubmit={submitLookup}>
            <input
              className="home__lookup-input"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder="जैसे 0095030"
              aria-label="सदस्य क्रमांक"
            />
            <button type="submit" className="home__btn home__btn--primary">जाँचें</button>
          </form>
        </div>
      </section>

      {/* ================= WORK ================= */}
      {org.supportText ? (
        <section className="home__section">
          <div className="home__wrap">
            <h2 className="home__h2">हमारा कार्य</h2>
            <p className="home__support">{org.supportText}</p>
          </div>
        </section>
      ) : null}

      {/* ================= HOW IT WORKS ================= */}
      <section className="home__section home__section--alt">
        <div className="home__wrap">
          <h2 className="home__h2">कार्ड कैसे बने</h2>
          <ol className="home__steps">
            <li className="home__step">
              <span className="home__step-n">1</span>
              <h3 className="home__step-title">जानकारी भरें</h3>
              <p className="home__step-text">नाम, पद, राज्य, ज़िला और फोटो — एक ही स्क्रीन में।</p>
            </li>
            <li className="home__step">
              <span className="home__step-n">2</span>
              <h3 className="home__step-title">कार्ड देखें</h3>
              <p className="home__step-text">तय डिज़ाइन में आपका कार्ड उसी वक्त तैयार होकर सामने आ जाता है।</p>
            </li>
            <li className="home__step">
              <span className="home__step-n">3</span>
              <h3 className="home__step-title">डाउनलोड करें</h3>
              <p className="home__step-text">PNG, PDF या प्रिंट — जो चाहें। उसके बाद WhatsApp से साझा करें।</p>
            </li>
          </ol>
        </div>
      </section>

      {/* ================= CONTACT ================= */}
      <section className="home__section">
        <div className="home__wrap home__contact">
          <div className="home__contact-card">
            <h2 className="home__h2">मुख्य कार्यालय</h2>
            {addressLines.length ? (
              <div className="home__contact-body">
                {addressLines.map((line) => (
                  <p className="home__contact-line" key={line}>
                    {line}
                  </p>
                ))}
              </div>
            ) : null}
            {contactLine ? (
              <p className="home__contact-line home__contact-line--phone">{contactLine}</p>
            ) : null}
          </div>
          <div className="home__contact-card home__contact-card--sign">
            <h2 className="home__h2">संस्थापक / अध्यक्ष</h2>
            <p className="home__sign-name">{org.signatoryName}</p>
            <p className="home__sign-role">{org.signatoryDesignation}</p>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="home__foot">
        <div className="home__wrap home__foot-inner">
          <p className="home__foot-org">{org.name || org.trustNameEn}</p>
          <p className="home__foot-reg">
            {org.registrationText ? `${org.registrationText} ${org.registrationValue}` : ''}
          </p>
          <a className="home__foot-link" href="/login">कार्यकर्ता लॉगिन</a>
        </div>
      </footer>
    </div>
  );
}