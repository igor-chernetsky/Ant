'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useTranslation } from '@/components/LocaleProvider';

export type ContractSignaturePadHandle = {
  isEmpty: () => boolean;
  toDataURL: () => string | null;
  clear: () => void;
};

interface ContractSignaturePadProps {
  disabled?: boolean;
  padRef: MutableRefObject<ContractSignaturePadHandle | null>;
}

/** Fixed CSS height of `.contract-signature-pad-canvas-wrap` — keep in sync. */
const CANVAS_HEIGHT_PX = 200;

export function ContractSignaturePad({
  disabled = false,
  padRef,
}: ContractSignaturePadProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<SignatureCanvas | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const syncWidth = () => {
      // Use content box width so canvas matches the drawable white area.
      const next = Math.max(1, Math.floor(el.clientWidth));
      setWidth((prev) => (prev === next ? prev : next));
    };

    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handle: ContractSignaturePadHandle = {
      isEmpty: () => canvasRef.current?.isEmpty() ?? true,
      toDataURL: () => {
        if (!canvasRef.current || canvasRef.current.isEmpty()) {
          return null;
        }
        try {
          return canvasRef.current.getTrimmedCanvas().toDataURL('image/png');
        } catch {
          return canvasRef.current.toDataURL('image/png');
        }
      },
      clear: () => canvasRef.current?.clear(),
    };
    padRef.current = handle;
    return () => {
      padRef.current = null;
    };
  }, [padRef]);

  return (
    <div className="contract-signature-pad">
      <div className="contract-signature-pad-header">
        <p className="contract-signature-pad-label">
          {t('contractPanel.drawSignatureRequired')}
        </p>
        <button
          type="button"
          className="secondary contract-signature-pad-clear"
          disabled={disabled}
          onClick={() => canvasRef.current?.clear()}
        >
          {t('contractPanel.clearSignature')}
        </button>
      </div>
      <div
        ref={wrapRef}
        className={`contract-signature-pad-canvas-wrap${
          disabled ? ' contract-signature-pad-canvas-wrap--disabled' : ''
        }`}
      >
        {width > 0 ? (
          <SignatureCanvas
            key={width}
            ref={(instance) => {
              canvasRef.current = instance;
            }}
            penColor="#0f172a"
            backgroundColor="#ffffff"
            clearOnResize={false}
            canvasProps={{
              className: 'contract-signature-pad-canvas',
              width,
              height: CANVAS_HEIGHT_PX,
              style: {
                width: `${width}px`,
                height: `${CANVAS_HEIGHT_PX}px`,
              },
            }}
          />
        ) : null}
      </div>
      <p className="muted contract-signature-pad-hint">
        {t('contractPanel.drawSignatureHint')}
      </p>
    </div>
  );
}
