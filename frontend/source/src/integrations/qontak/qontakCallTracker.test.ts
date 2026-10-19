import { describe, expect, it } from 'vitest';
import type { CallInfo } from '../../services/sipService';
import { initialTrackerState, stepTracker } from './qontakCallTracker';
import type { TrackerState } from './qontakCallTracker';

const base: CallInfo = {
  state: 'IDLE',
  remoteNumber: '',
  remoteName: '',
  duration: 0,
  isMuted: false,
  isHeld: false,
  recordingActive: false,
  direction: null,
  attendedTransfer: { active: false } as any,
  conference: { original: null, participants: [null, null] },
};

const run = (steps: Partial<CallInfo>[]) => {
  let state: TrackerState = initialTrackerState();
  const events: any[] = [];
  let n = 0;
  for (const s of steps) {
    const r = stepTracker(state, { ...base, ...s } as CallInfo, new Date(1_700_000_000_000 + n * 1000), () => `id-${events.filter((e) => e.event === 'started').length + 1}`);
    n += 1;
    state = r.state;
    events.push(...r.events);
  }
  return events;
};

describe('qontakCallTracker', () => {
  it('answered inbound call -> started, answered, ended completed with talk time', () => {
    const ev = run([
      { state: 'RINGING', direction: 'INCOMING', remoteNumber: '+628123456789' },
      { state: 'RINGING', direction: 'INCOMING', remoteNumber: '+628123456789' },
      { state: 'ANSWERING', direction: 'INCOMING', remoteNumber: '+628123456789' },
      { state: 'ACTIVE', direction: 'INCOMING', remoteNumber: '+628123456789', duration: 0 },
      { state: 'ACTIVE', direction: 'INCOMING', remoteNumber: '+628123456789', duration: 1 },
      { state: 'ACTIVE', direction: 'INCOMING', remoteNumber: '+628123456789', duration: 42 },
      { state: 'ENDED', direction: 'INCOMING', remoteNumber: '+628123456789', duration: 42, endedReason: 'Answered' },
      { state: 'IDLE' },
    ]);
    expect(ev.map((e) => e.event)).toEqual(['started', 'answered', 'ended']);
    expect(ev[0]).toMatchObject({ direction: 'inbound', remote_number: '+628123456789', local_call_id: 'id-1' });
    expect(ev[2]).toMatchObject({ status: 'completed', talk_duration: 42 });
  });

  it('ringing but never answered is missed, never completed', () => {
    const ev = run([
      { state: 'RINGING', direction: 'INCOMING', remoteNumber: '0812' },
      { state: 'ENDED', direction: 'INCOMING', remoteNumber: '0812', endedReason: 'Missed' },
    ]);
    expect(ev[ev.length - 1]).toMatchObject({ event: 'ended', status: 'missed', talk_duration: 0 });
    expect(ev.some((e) => e.event === 'answered')).toBe(false);
  });

  it('declined incoming call is rejected', () => {
    const ev = run([
      { state: 'RINGING', direction: 'INCOMING', remoteNumber: '0812' },
      { state: 'ENDED', direction: 'INCOMING', remoteNumber: '0812', endedReason: 'Rejected' },
    ]);
    expect(ev[ev.length - 1]).toMatchObject({ status: 'rejected' });
  });

  it('outgoing failure and no-answer', () => {
    const failed = run([
      { state: 'DIALING', direction: 'OUTGOING', remoteNumber: '021555' },
      { state: 'FAILED', direction: 'OUTGOING', remoteNumber: '021555', endedReason: 'Failed' },
    ]);
    expect(failed[failed.length - 1]).toMatchObject({ direction: 'outbound', status: 'failed' });

    const noAnswer = run([
      { state: 'DIALING', direction: 'OUTGOING', remoteNumber: '021555' },
      { state: 'ENDED', direction: 'OUTGOING', remoteNumber: '021555', endedReason: 'Missed' },
    ]);
    expect(noAnswer[noAnswer.length - 1]).toMatchObject({ status: 'no_answer' });
  });

  it('emits each event once despite the per-second re-notifications, and a new id per call', () => {
    const ev = run([
      { state: 'DIALING', direction: 'OUTGOING', remoteNumber: '1' },
      { state: 'ACTIVE', direction: 'OUTGOING', remoteNumber: '1', duration: 1 },
      { state: 'ACTIVE', direction: 'OUTGOING', remoteNumber: '1', duration: 2 },
      { state: 'ENDED', direction: 'OUTGOING', remoteNumber: '1', duration: 2 },
      { state: 'ENDED', direction: 'OUTGOING', remoteNumber: '1', duration: 2 },
      { state: 'IDLE' },
      { state: 'RINGING', direction: 'INCOMING', remoteNumber: '2' },
      { state: 'ENDED', direction: 'INCOMING', remoteNumber: '2' },
    ]);
    expect(ev.map((e) => `${e.local_call_id}:${e.event}`)).toEqual([
      'id-1:started', 'id-1:answered', 'id-1:ended', 'id-2:started', 'id-2:ended',
    ]);
  });

  it('ignores IDLE with no call and does nothing for subscribe() initial snapshot', () => {
    expect(run([{ state: 'IDLE' }, { state: 'IDLE' }])).toEqual([]);
  });
});
