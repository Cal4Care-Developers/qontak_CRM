import type { CallInfo } from '../../services/sipService';
import type { CallEventInput, CallStatus } from './qontakApi';

// Turns the dialer's sipService state stream into discrete Qontak call events.
//
// sipService re-notifies every second while a call is up (duration timer), so
// this is edge-detected against the previous state and only emits on a real
// transition. It only READS CallInfo -- nothing here touches the call itself.
//
//   IDLE/ENDED/FAILED -> RINGING (incoming) | DIALING (outgoing)   => 'started'
//   anything          -> ACTIVE (first time for this call)          => 'answered'
//   in-call           -> ENDED | FAILED                             => 'ended' + final status
//
// Final status rules (a ringing-but-never-answered call is NEVER 'completed'):
//   answered                         -> 'completed'
//   incoming, endedReason Rejected   -> 'rejected'
//   incoming, otherwise              -> 'missed'
//   outgoing, state FAILED           -> 'failed'
//   outgoing, otherwise              -> 'no_answer'
// sipService does not expose the SIP reject code for outgoing calls, so busy /
// declined outbound calls report as 'no_answer' (see the backend README).

export interface TrackedCall {
  localCallId: string;
  direction: 'inbound' | 'outbound';
  remoteNumber: string;
  startedAt: string;
  answeredAt: string | null;
}

export interface TrackerState {
  prevState: CallInfo['state'];
  call: TrackedCall | null;
}

export const initialTrackerState = (): TrackerState => ({ prevState: 'IDLE', call: null });

const IN_CALL = new Set<CallInfo['state']>(['DIALING', 'RINGING', 'ANSWERING', 'ACTIVE', 'HOLD']);

export const finalStatus = (call: TrackedCall, info: Pick<CallInfo, 'state' | 'endedReason'>): CallStatus => {
  if (call.answeredAt) return 'completed';
  if (call.direction === 'inbound') return info.endedReason === 'Rejected' ? 'rejected' : 'missed';
  return info.state === 'FAILED' ? 'failed' : 'no_answer';
};

const newId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `qk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function stepTracker(
  state: TrackerState,
  info: CallInfo,
  now: Date = new Date(),
  makeId: () => string = newId,
): { state: TrackerState; events: CallEventInput[] } {
  const events: CallEventInput[] = [];
  let call = state.call;
  const iso = now.toISOString();

  // Call starts: first time we see it ringing (in) or dialing (out).
  if (!call && (info.state === 'RINGING' || info.state === 'DIALING' || info.state === 'ACTIVE') && info.direction) {
    call = {
      localCallId: makeId(),
      direction: info.direction === 'INCOMING' ? 'inbound' : 'outbound',
      remoteNumber: (info.remoteNumber || '').trim(),
      startedAt: iso,
      answeredAt: null,
    };
    events.push({
      local_call_id: call.localCallId,
      event: 'started',
      direction: call.direction,
      remote_number: call.remoteNumber,
      status: 'ringing',
      started_at: call.startedAt,
    });
  }

  if (call && info.state === 'ACTIVE' && !call.answeredAt) {
    call = { ...call, answeredAt: iso };
    events.push({
      local_call_id: call.localCallId,
      event: 'answered',
      direction: call.direction,
      remote_number: call.remoteNumber,
      status: 'answered',
      started_at: call.startedAt,
      answered_at: call.answeredAt ?? undefined,
    });
  }

  if (call && (info.state === 'ENDED' || info.state === 'FAILED' || (info.state === 'IDLE' && IN_CALL.has(state.prevState)))) {
    events.push({
      local_call_id: call.localCallId,
      event: 'ended',
      direction: call.direction,
      remote_number: call.remoteNumber,
      status: finalStatus(call, info),
      started_at: call.startedAt,
      answered_at: call.answeredAt ?? undefined,
      ended_at: iso,
      talk_duration: call.answeredAt ? Math.max(0, Math.round(info.duration || 0)) : 0,
    });
    call = null;
  }

  return { state: { prevState: info.state, call }, events };
}
