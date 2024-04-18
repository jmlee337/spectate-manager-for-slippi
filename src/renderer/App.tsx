import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import { useEffect, useState } from 'react';
import Settings from './Settings';
import { OBSInput, OBSSettings } from '../common/types';

function Hello() {
  const [appVersion, setAppVersion] = useState('');
  const [latestAppVersion, setLatestAppVersion] = useState('');
  const [obsSettings, setObsSettings] = useState<OBSSettings>({
    protocol: 'ws',
    address: '127.0.0.1',
    port: '4455',
  });
  const [gotSettings, setGotSettings] = useState(false);
  useEffect(() => {
    const inner = async () => {
      const appVersionPromise = window.electron.getVersion();
      const latestAppVersionPromise = window.electron.getLatestVersion();
      const obsSettingsPromise = window.electron.getObsSettings();
      setAppVersion(await appVersionPromise);
      setLatestAppVersion(await latestAppVersionPromise);
      setObsSettings(await obsSettingsPromise);
      setGotSettings(true);
    };
    inner();
  }, []);

  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [obsInputs, setObsInputs] = useState<OBSInput[]>([]);
  return (
    <Stack>
      <Stack direction="row" justifyContent="end" gap="8px">
        <Settings
          obsSettings={obsSettings}
          setObsSettings={setObsSettings}
          appVersion={appVersion}
          latestAppVersion={latestAppVersion}
          gotSettings={gotSettings}
        />
        <Button
          disabled={connecting || connected}
          endIcon={connecting && <CircularProgress size="24px" />}
          onClick={async () => {
            setConnecting(true);
            try {
              await window.electron.connect();
              setConnected(true);
              setObsInputs(await window.electron.getInputs());
            } catch (e: any) {
              setError(e instanceof Error ? e.message : e);
            } finally {
              setConnecting(false);
            }
          }}
          variant="contained"
        >
          Connect
        </Button>
      </Stack>
      <Stack direction="row">
        <Stack>
          {obsInputs.map((obsInput) => (
            <div key={obsInput.uuid}>{obsInput.name}</div>
          ))}
        </Stack>
      </Stack>
      <Dialog
        open={error.length > 0}
        onClose={() => {
          setError('');
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Error!</DialogTitle>
        <DialogContent>
          <Alert severity="error">{error}</Alert>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setError('');
            }}
            variant="contained"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
