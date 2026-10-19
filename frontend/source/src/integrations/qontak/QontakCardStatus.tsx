import React, { useEffect, useState } from 'react';
import { qontakApi, ok, QONTAK_CONFIG_CHANGED } from './qontakApi';
import type { QontakConfig } from './qontakApi';

// Status badge for the Qontak card on Integrations → CRM. Loads its own state
// so IntegrationsModal needs no Qontak-specific state or fetch logic.
const QontakCardStatus: React.FC = () => {
  const [config, setConfig] = useState<QontakConfig | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      qontakApi.getConfig()
        .then((data) => { if (alive) setConfig(ok(data) && data.content ? (data.content as QontakConfig) : null); })
        .catch(() => { if (alive) setConfig(null); });
    };
    load();
    window.addEventListener(QONTAK_CONFIG_CHANGED, load);
    return () => { alive = false; window.removeEventListener(QONTAK_CONFIG_CHANGED, load); };
  }, []);

  let tone = '';
  let label = 'Not configured';
  if (config?.connection_status === 'error') { tone = ' intg-badge-danger'; label = 'Connection error'; }
  else if (config?.client_secret_set && config.enabled) { tone = ' intg-badge-success'; label = 'Enabled'; }
  else if (config?.client_secret_set) { label = 'Disabled'; }

  return (
    <span className={`intg-badge${tone}`}>
      <span className="intg-badge-dot" aria-hidden="true" />
      {label}
    </span>
  );
};

export default QontakCardStatus;
