import { useEffect, useRef, useState } from 'react';
import { CARD } from '../config/cardDesign';
import IDCardTemplate from './IDCard/IDCardTemplate';

/**
 * CardStage
 * ---------------------------------------------------------------------------
 * Renders the locked IDCardTemplate at a fixed 856x540 canvas and uniformly
 * scales it to fit its container.
 *
 * Why a transform rather than a fluid width: the card's internal layout is
 * absolute and measured in px. If the canvas itself resized, the design would
 * reflow and the on-screen preview would stop matching the exported PNG/PDF.
 * Scaling the finished card keeps the preview pixel-identical to the output and
 * guarantees the aspect ratio is preserved at every screen size.
 */
export default function CardStage({
  organization,
  member,
  verifyUrl,
  className = '',
  showDemoFlag,
  cardRef,
  children,
}) {
  const containerRef = useRef(null);
  const [measured, setMeasured] = useState(CARD.width);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const update = () => setMeasured(node.clientWidth || CARD.width);
    update();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const scale = Math.min(1, measured / CARD.width);
  const height = CARD.height * scale;

  return (
    <div ref={containerRef} className={className} style={{ width: '100%' }}>
      <div
        style={{
          width: CARD.width * scale,
          height,
          overflow: 'hidden',
          position: 'relative',
          margin: '0 auto',
        }}
      >
        <div className="idcard-scale" style={{ transform: `scale(${scale})` }}>
          <div style={{ width: CARD.width, height: CARD.height }}>
            <IDCardTemplate
              ref={cardRef}
              organization={organization}
              member={member}
              verifyUrl={verifyUrl}
              showDemoFlag={showDemoFlag}
            />
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}