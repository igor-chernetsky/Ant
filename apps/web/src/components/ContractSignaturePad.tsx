'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
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

export function ContractSignaturePad({
  disabled = false,
  padRef,
}: ContractSignaturePadProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<SignatureCanvas | null>(null);

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
          {t('contractPanel.drawSignatureOptional')}
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
        className={`contract-signature-pad-canvas-wrap${
          disabled ? ' contract-signature-pad-canvas-wrap--disabled' : ''
        }`}
      >
        <SignatureCanvas
          ref={(instance) => {
            canvasRef.current = instance;
          }}
          penColor="#0f172a"
          backgroundColor="#ffffff"
          canvasProps={{
            className: 'contract-signature-pad-canvas',
            width: 480,
            height: 160,
          }}
        />
      </div>
      <p className="muted contract-signature-pad-hint">
        {t('contractPanel.drawSignatureHint')}
      </p>
    </div>
  );
}
