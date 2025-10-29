/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface ApiKeyDialogProps {
  onContinue: () => void;
}

const ApiKeyDialog: React.FC<ApiKeyDialogProps> = ({ onContinue }) => {
  return (
    <div className="api-key-dialog-overlay">
      <div className="api-key-dialog">
        <h2>[ API Key Required ]</h2>
        <p>
          Veo is a paid-only video generation model. To use this feature, please select an API key associated with a Google Cloud project that has billing enabled.
        </p>
        <p>
          For more information, see the{' '}
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
          >
            how to enable billing
          </a>{' '}
          and{' '}
          <a
            href="https://ai.google.dev/gemini-api/docs/pricing#veo-3"
            target="_blank"
            rel="noopener noreferrer"
          >
            Veo pricing
          </a>.
        </p>
        <button
          onClick={onContinue}
        >
          Continue to Select API Key
        </button>
      </div>
    </div>
  );
};

export default ApiKeyDialog;
