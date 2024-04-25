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
import { Cable } from '@mui/icons-material';
import Settings from './Settings';
import { OBSInput, OBSSettings, SpectatingBroadcast } from '../common/types';

function Hello() {
  const [appVersion, setAppVersion] = useState('');
  const [latestAppVersion, setLatestAppVersion] = useState('');
  const [obsSettings, setObsSettings] = useState<OBSSettings>({
    protocol: 'ws',
    address: '127.0.0.1',
    port: '4455',
  });
  const [spectateEndpoint, setSpectateEndpoint] = useState(
    'ws://127.0.0.1:49809',
  );
  const [connected, setConnected] = useState(false);
  const [spectatingBroadcasts, setSpectatingBroadcasts] = useState<
    SpectatingBroadcast[]
  >([]);
  const [obsInputs, setObsInputs] = useState<OBSInput[]>([]);
  const [gotSettings, setGotSettings] = useState(false);
  useEffect(() => {
    const inner = async () => {
      const appVersionPromise = window.electron.getVersion();
      const latestAppVersionPromise = window.electron.getLatestVersion();
      const obsSettingsPromise = window.electron.getObsSettings();
      const spectateEndpointPromise = window.electron.getSpectateEndpoint();
      const newConnected = await window.electron.getConnected();
      setAppVersion(await appVersionPromise);
      setLatestAppVersion(await latestAppVersionPromise);
      setObsSettings(await obsSettingsPromise);
      setSpectateEndpoint(await spectateEndpointPromise);
      setConnected(newConnected);
      if (newConnected) {
        const obsInputsPromise = window.electron.getInputs();
        const spectatingBroadcastsPromise =
          window.electron.getSpectatingBroadcasts();
        setObsInputs(await obsInputsPromise);
        setSpectatingBroadcasts(await spectatingBroadcastsPromise);
      }
      setGotSettings(true);
    };
    inner();
  }, []);
  useEffect(() => {
    window.electron.onDisconnect(() => {
      setConnected(false);
    });
  }, []);

  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  return (
    <Stack>
      <Stack direction="row" justifyContent="end" gap="8px">
        <Settings
          obsSettings={obsSettings}
          setObsSettings={setObsSettings}
          spectateEndpoint={spectateEndpoint}
          setSpectateEndpoint={setSpectateEndpoint}
          appVersion={appVersion}
          latestAppVersion={latestAppVersion}
          gotSettings={gotSettings}
        />
        <Button
          disabled={connecting || connected}
          endIcon={
            !connected &&
            (connecting ? <CircularProgress size="24px" /> : <Cable />)
          }
          onClick={async () => {
            setConnecting(true);
            try {
              await window.electron.connect();
              setConnected(true);
              const obsInputsPromise = window.electron.getInputs();
              const spectatingBroadcastsPromise =
                window.electron.getSpectatingBroadcasts();
              setObsInputs(await obsInputsPromise);
              setSpectatingBroadcasts(await spectatingBroadcastsPromise);
            } catch (e: any) {
              setError(e instanceof Error ? e.message : e);
            } finally {
              setConnecting(false);
            }
          }}
          variant="contained"
        >
          {connected ? 'Connected' : 'Connect'}
        </Button>
      </Stack>
      <Stack direction="row">
        <Stack>
          {obsInputs.map((obsInput) => (
            <div key={obsInput.uuid}>{obsInput.name}</div>
          ))}
        </Stack>
        <Stack>
          {spectatingBroadcasts.map((spectatingBroadcast) => (
            <div
              key={`${spectatingBroadcast.broadcastId}${spectatingBroadcast.dolphinId}`}
            >
              {spectatingBroadcast.dolphinId}: {spectatingBroadcast.broadcastId}
            </div>
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
