import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { setHolidayBootstrap } from './services/holidayStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { ID_TO_PATH, DEFAULT_PAGE_ID, resolvePagePath } from './router/pageRoutes';
import { translateNav, RTL_LANGUAGES } from './i18n/navTranslations';
import './App.css';
import { LoginPage } from './pages/LoginPage';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { AppSidebarNav } from './components/AppSidebarNav';
import { AppSearch } from './components/AppSearch';
import { GLOBAL_SETTING_SEARCH_ITEMS } from './components/GlobalSettings';
import { canManageSupportAccess } from './services/supportAccessApi';
import { Button } from './components/base/buttons/button';
import { Input } from './components/base/input/input';
import { InfoHint } from './components/base/info-hint/InfoHint';
import { TeamDirectory } from './components/TeamDirectory';
import { CallStatusTabs } from './components/CallStatusTabs';
import { AdvancedWallboard } from './components/AdvancedWallboard';
import { CallFlowBuilder } from './components/CallFlowBuilder';
import { QueueModule } from './pages/QueueModule';
import { OthersModule } from './pages/OthersModule';
import { GlobalSettings } from './components/GlobalSettings';
import { CaptureModal } from './components/CaptureModal';
import { Select } from './components/base/select/select';
import { DashboardRecentCalls } from './components/DashboardRecentCalls';
import { DashboardTrunkLine } from './components/DashboardTrunkLine';
import { peekDashboardView, loadDashboardView, saveDashboardView } from './services/dashboardView';
import { sipService } from './services/sipService';
import { soundService } from './services/soundService';
import { socketService } from './services/socketService';
import { getApiBaseUrl, getApiHost } from './services/apiConfig';
import { ActionOtpDialog } from './components/ActionOtpDialog';
import { sendUpdateOtp, verifyUpdateOtp } from './services/verifiedActions';
import { computeSingleInstance, computeMultiTenantLicenseOwner, computeIsMultiTenantRootDomain } from './utils/licenseGating';
import {
  SYSTEM_STATUS_RANGES,
  SYSTEM_STATUS_DEFAULT_RANGE,
  systemStatusRebuildSeries,
  systemStatusAppendLive,
  systemStatusWindow,
  systemStatusSegments,
  systemStatusIsStale,
  systemStatusRelativeAge,
  systemStatusNiceIntervalMinutes,
  systemStatusTicks,
  systemStatusAxisLabel,
  systemStatusTooltipTimestamp,
} from './utils/systemStatus';
import { useTabIndicator } from './hooks/useTabMotion';
import SMS from './components/SMS';
import Chat from './components/Chat';
import { UserRoles } from './components/UserRoles';
import ExtensionsPage from './components/ExtensionsPage';
import MyProfilePage from './components/MyProfilePage';
import CalendarModal from './components/CalendarModal';
import Connections from './components/connections';
import Voicemails from './components/voicemails';
import Contacts from './components/Contacts';
import { Chameleon, DEFAULT_HOTEL_PARAMS } from './components/Chameleon';
import { checkContact } from './services/queueApi';
import { QueueCallLandingModal } from './components/QueueCallLandingModal';
import { toast } from 'react-toastify';
import { UpdateReadyDialog } from './components/UpdateReadyDialog';
import { normalizeUpdateReady, seenKey, updateReadyView } from './utils/updateReady';
import { ToastContainer as RingToastContainer } from './utils/ringToast';
import {
  CALL_LANDING_QUEUE_RESOLVE_GRACE_MS,
  CRM_LANDING_OPTIONS,
  callLandingExternalUrl,
  extensionLandingActsOn,
  isExternalCallerNumber,
  isNoCallLanding,
  landingEnabledForDirection,
  openCallLandingTab,
  opensExternal,
  opensLocalContact,
  queueCrmTabOpensOn,
  queueLocalContactActsOn,
} from './utils/callLanding';
import EFax from './components/EFax';
import HotelFrontDeskPage from './components/HotelFrontDeskPage';
import { fetchHotelFrontDeskMenuEnabled } from './services/hotelFrontDeskApi';

import PreviousBuildsPage from './components/PreviousBuildsPage';
import { IoIosGitMerge } from "react-icons/io";
import { appAsset } from './utils/appAsset';
import { Dialer } from './components/Dialer/Dialer';
import { SupportDrawer } from './components/SupportDrawer';
import { Topbar } from './components/layout/Topbar';
import { MicPermissionPrompt } from './components/layout/MicPermissionPrompt';
import ResizableMeetWindow, { defaultMeetWindowGeometry } from './components/Meet/ResizableMeetWindow';
import { IDLE_MEET_WINDOW_STATE } from './components/Meet/meetWindowState';
import LobbyScreen from './components/Meet/screens/LobbyScreen';
import { useMeetLaunchRequest, clearMeetLaunch } from './components/Meet/meetLaunchBus';
import { useMeetSession } from './hooks/useMeetSession';
import { useActiveMeetingsBadge } from './hooks/useActiveMeetingsBadge';
import { useSupportTickets } from './hooks/useSupportTickets';

import {
  resolveHeaderAvatarUrl,
  parseCallRowsArray,
  readDirectoryCache,
  writeDirectoryCache,
  updateDirectoryCacheCallerId,
  clearDirectoryCache,
} from './utils/appHelpers';
import { clearChatMessageCaches } from './utils/chatMessageCache';
import { readStoredSession } from './utils/storedSession';
import QontakCallBridge from './integrations/qontak/QontakCallBridge';
import { updateBannerState, updateWasApplied, releaseOf, showBuildUpdateButton } from './utils/updateBanner';

// Neutral grey for "status not known yet" (same as extensionPresence's NEUTRAL).
const PRESENCE_UNKNOWN = '#8892b0';
import { VideoGuidesModal } from './components/VideoGuidesModal';
import { PRESENCE_AVAILABLE, PRESENCE_BUSY, softPresenceColor } from './utils/presenceColors';
import { resolveExtensionPresence, isPushReachable, mobileReach } from './utils/extensionPresence';
import { setDevicePresenceStore, setLivePresenceInputs } from './utils/devicePresenceStore';

export default function App() {
  // Authentication & session states
  // Restore a saved session synchronously so a refresh renders the app on the
  // very first frame instead of flashing the gateway loader. Verify/recover
  // links still go through the loader since they must hit the API first.
  const initialSession = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('verify') || params.get('recover')) return null;
    return readStoredSession();
  }, []);
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!initialSession);
  const [authLoading, setAuthLoading] = useState(() => !initialSession);
  const [userSession, setUserSession] = useState(() => initialSession || {});
  const [webPassword2, setWebPassword2] = useState(true);
  const [whiteLabelLogo, setWhiteLabelLogo] = useState('');
  // Seeded from the previous session's api/index response (if any) so a
  // page refresh renders the permission-gated topbar controls immediately
  // and correctly, instead of showing/hiding them a second time once the
  // fresh fetch lands a few seconds later (fetchDashboardData below keeps
  // this cache current on every poll).
  const cachedHeaderChrome = useMemo(() => {
    try {
      const raw = localStorage.getItem('headerChromeCache');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);
  const [permissionMode, setPermissionMode] = useState(() => cachedHeaderChrome?.permissionMode ?? 7);

  // Header chrome state (home.dart:4511-5527) -- Credit Left/Call Cost gate,
  // Clear Cache, Desktop App and Language menu.
  const [companyLimits, setCompanyLimits] = useState(() => cachedHeaderChrome?.companyLimits ?? {});
  const [balance, setBalance] = useState(0);
  const [gatewayStatus, setGatewayStatus] = useState(false);
  const [appEnabled, setAppEnabled] = useState(false);
  const [webappEnabled, setWebappEnabled] = useState(false);
  const [callcontrolEnabled, setCallcontrolEnabled] = useState(false);
  const [showClearCacheDialog, setShowClearCacheDialog] = useState(false);
  const [clearCacheError, setClearCacheError] = useState('');
  const [isOpeningDesktop, setIsOpeningDesktop] = useState(false);
  const [showDesktopDownloadDialog, setShowDesktopDownloadDialog] = useState(false);
  const [desktopWindowsUrl, setDesktopWindowsUrl] = useState('');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [langMenuPosition, setLangMenuPosition] = useState({ top: 0, left: 0 });
  const langDropdownRef = useRef(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileMenuPosition, setProfileMenuPosition] = useState({ top: 0, left: 0 });
  const profileChipRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  // RingQ Meet (home.dart:283,7020-7081, widgets/resizable_meet_window.dart) --
  // a global floating window, not a routed page, so it must survive
  // navigating between activePage values same as it does in Flutter.
  const [meetWindowOpen, setMeetWindowOpen] = useState(false);
  const [meetWindowMinimized, setMeetWindowMinimized] = useState(false);
  const [meetWindowState, setMeetWindowState] = useState(IDLE_MEET_WINDOW_STATE);
  const meetGeometryRef = useRef(defaultMeetWindowGeometry());
  const meetSession = useMeetSession();
  const { activeCount: meetActiveCount, refresh: refreshMeetBadge } = useActiveMeetingsBadge(meetSession);
  const meetTooltip =
    meetActiveCount <= 0
      ? 'Meet'
      : meetActiveCount === 1
        ? 'Meet — 1 meeting still open'
        : `Meet — ${meetActiveCount} meetings still open`;
  const openMeetWindow = useCallback(() => {
    setMeetWindowOpen(true);
    setMeetWindowMinimized(false);
  }, []);
  const closeMeetWindow = useCallback(() => {
    setMeetWindowState(IDLE_MEET_WINDOW_STATE);
    // Closing the window is not ending the meeting -- re-read so the badge
    // picks up a room left running (home.dart:19758-19772).
    refreshMeetBadge();
    clearMeetLaunch();
    setMeetWindowOpen(false);
    setMeetWindowMinimized(false);
  }, [refreshMeetBadge]);
  const meetLaunchRequest = useMeetLaunchRequest();
  useEffect(() => {
    if (meetLaunchRequest) openMeetWindow();
  }, [meetLaunchRequest, openMeetWindow]);
  const handleMeetLaunchHandled = useCallback(() => {
    clearMeetLaunch(meetLaunchRequest);
  }, [meetLaunchRequest]);
  // Real avatar image (home.dart:5116-5521, session["image"]) -- falls back
  // to initials on load failure, same as TeamDirectory.tsx's ContactAvatar.
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  useEffect(() => { setAvatarLoadFailed(false); }, [userSession.image]);
  const headerAvatarUrl = useMemo(() => {
    if (avatarLoadFailed) return null;
    return resolveHeaderAvatarUrl(userSession.image, userSession.subdomain || getApiHost());
  }, [avatarLoadFailed, userSession.image, userSession.subdomain]);

  // Flutter's PopupMenuButton (home.dart:4961-5090) dismisses on any outside
  // tap natively; reproduce that for the Language dropdown. The dropdown
  // itself renders via a portal straight into document.body (see below --
  // it was getting clipped/hidden behind page content because .topbar
  // doesn't establish its own stacking context, so a z-index on the
  // dropdown alone couldn't reliably beat every page's own content), which
  // physically moves it outside langMenuRef's DOM subtree -- check
  // langDropdownRef too, or every click inside the portal would
  // (incorrectly) count as "outside" and close the menu before the item's
  // own click could register.
  useEffect(() => {
    if (!showLangMenu) return;
    const handleClickOutside = (e) => {
      if (
        langMenuRef.current && !langMenuRef.current.contains(e.target) &&
        langDropdownRef.current && !langDropdownRef.current.contains(e.target)
      ) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLangMenu]);

  // Same outside-click-to-dismiss pattern as the Language dropdown above.
  useEffect(() => {
    if (!showProfileMenu) return;
    const handleClickOutside = (e) => {
      if (
        profileChipRef.current && !profileChipRef.current.contains(e.target) &&
        profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)
      ) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);
  // Shared shell for header features whose full backend/CRUD is a separate,
  // larger follow-up pass (Calendar's Meetings/Bookings/Webinars scheduler,
  // Call Cost's report) -- {title} when open, null when closed.
  const [featurePlaceholder, setFeaturePlaceholder] = useState(null);

  // SIP Calling & registration states
  const [sipRegState, setSipRegState] = useState(() => {
    try {
      return sipService.getRegistrationState();
    } catch {
      return 'UNREGISTERED';
    }
  });
  const [sipCallInfo, setSipCallInfo] = useState({
    state: 'IDLE',
    remoteNumber: '',
    remoteName: '',
    duration: 0,
    isMuted: false,
    isHeld: false,
    recordingActive: false,
    direction: null,
    attendedTransfer: { active: false, waitingLeg: 0, original: null, destination: null },
    conference: { original: null, participants: [null, null] }
  });

  // In-call UI control states
  const [showInCallKeypad, setShowInCallKeypad] = useState(false);
  // Running display of DTMF tones sent this call -- matches initiation.dart's
  // `_dtmf` string, reset each time the keypad is (re)opened.
  const [dtmfInput, setDtmfInput] = useState('');
  const [showTransferPopup, setShowTransferPopup] = useState(false);
  const [transferNumber, setTransferNumber] = useState('');
  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  const [showTransferDialpad, setShowTransferDialpad] = useState(false);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);

  // Conference panel states
  const [showConferencePanel, setShowConferencePanel] = useState(false);
  const [activeConferenceAddSlot, setActiveConferenceAddSlot] = useState(null); // 0 | 1 | null
  const [conferenceAddNumber, setConferenceAddNumber] = useState('');
  const [conferenceSearchQuery, setConferenceSearchQuery] = useState('');

  // Premium In-Call Drawer states and gesture controls
  const [drawerState, setDrawerState] = useState('collapsed'); // 'collapsed' | 'full'
  const [dragY, setDragY] = useState(0);
  const [isDrawerDragging, setIsDrawerDragging] = useState(false);
  const [localRecording, setLocalRecording] = useState(false);

  // modalpopup states
  const [showOutboundModal, setShowOutboundModal] = useState(false);
  const [outboundRules, setOutboundRules] = useState([]);
  const [outboundLoading, setOutboundLoading] = useState(false);
  const [outboundError, setOutboundError] = useState('');
  const [outboundSearch, setOutboundSearch] = useState('');
  const filteredOutboundRules = outboundRules.filter((rule) => {
    const query = outboundSearch.trim().toLowerCase();
    if (!query) return true;

    const normalized = [
      rule.rule_name,
      rule.route,
      rule.destination,
      rule.trunk,
      rule.teams,
      rule.extensions,
      rule.prefix,
      rule.length,
      rule.strip,
      rule.prepend,
      rule.caller_id,
      rule.callerId,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return normalized.includes(query);
  });
  const dragStartY = useRef(0);

  const getDrawerTargetY = (state) => {
    switch (state) {
      case 'full': return 0;
      case 'collapsed':
      default: return 208;
    }
  };

  const handleDragStart = (e) => {
    setIsDrawerDragging(true);
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
  };

  const handleDragMove = (e) => {
    if (!isDrawerDragging) return;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - dragStartY.current;
    setDragY(deltaY);
  };

  const handleDragEnd = () => {
    if (!isDrawerDragging) return;
    const targetY = getDrawerTargetY(drawerState);
    const finalY = targetY + dragY;

    let nextState = 'collapsed';
    if (finalY < 104) {
      nextState = 'full';
    } else {
      nextState = 'collapsed';
    }

    setDrawerState(nextState);
    setDragY(0);
    setIsDrawerDragging(false);
  };

  const handleHandleTap = () => {
    if (isDrawerDragging) return;
    if (drawerState === 'collapsed') {
      setDrawerState('full');
    } else {
      setDrawerState('collapsed');
    }
  };

  // Ring refs for audio-reactive animations
  const outerRingRef = useRef(null);
  const innerRingRef = useRef(null);
  const langMenuRef = useRef(null);

  // Audio devices states
  const [microphones, setMicrophones] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState({ microphoneId: 'default', speakerId: 'default' });

  // Edge-detection state for the incoming-call desktop notification / tab-title
  // alert below -- not ported from Flutter (it has no foreground notification
  // of its own, see investigation), built fresh against the ticket's spec.
  const prevCallStateRef = useRef('IDLE');
  const incomingNotificationRef = useRef(null);
  const originalTitleRef = useRef(document.title);

  // Request desktop-notification permission once, right after login (a real
  // user gesture already happened to get here). Notification.permission is
  // 'default' only the very first time -- the browser remembers a granted or
  // denied answer across sessions, so this never re-prompts.
  useEffect(() => {
    if (isAuthenticated && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { });
    }
  }, [isAuthenticated]);

  // Queue Call Landing runtime -- mirrors home.dart's _checkContact exactly (queue branch only,
  // home.dart:22851-22930): looks up the caller against Contacts for the queue this call rang
  // through, then shows the contact/create-contact popup and/or opens the queue's configured
  // external URL/CRM in a new tab, gated by the queue's own Wrap-up + Queue Call Landing settings
  // (QueueFormPage.tsx's Settings tab). `trigger` is 'ring' (call just started ringing) or
  // 'accept' (call was just answered), matching Flutter's type 1 vs type 3 call sites.
  //
  // Queue extension resolution: two independent, both real, mechanisms -- confirmed by two
  // separate live test calls on this tenant that disagreed with each other.
  // 1. sipService's SIP-header-based parsing (`queueExtension` on callInfo,
  //    parseIncomingIdentity()) -- a live INVITE trace (2026-09-17) showed
  //    `From: "63401005 (9001)" <sip:63401005%20(9001)@sgringq100.ringq.ai>`, i.e. this deployment DOES
  //    embed the queue extension as a "(digits)" marker on a direct-to-queue-extension test call.
  //    Used immediately/synchronously when present -- no need to wait on anything else.
  // 2. The live wallboard socket feed (queueCallboard's `cid_number` + `queue` fields, confirmed
  //    live on a DIFFERENT real call, an external DID routed into a queue:
  //    `{"queue":"9034@sgringq100.ringq.ai", "cid_number":"63401005", "cid_name":"(9034)",
  //    "state":"Trying", ...}`) -- that same test's raw SIP trace carried no marker at all on
  //    either the URI user or the display name, so the header fast path above resolves to nothing
  //    for that call path and this is the only signal available. That feed can arrive a beat
  //    before or after the SIP ring/accept event, so both the SIP subscription (below) and the
  //    socketService subscription (search "attemptPendingQueueLanding") retry the match whenever
  //    new data arrives from either side, until one succeeds.
  // Path 1 is tried first (see the `callInfo.queueExtension` check below); path 2 only runs when
  // path 1 finds nothing, since which one actually carries the marker depends on how the call
  // reached the queue, not on the tenant/account.
  const queueWallboardCallsRef = useRef([]);
  const pendingQueueLandingRef = useRef({ ring: null, accept: null });
  const queueLandingExtRef = useRef('');

  const resolveQueueExtensionForNumber = useCallback((remoteNumber) => {
    const digits = (remoteNumber || '').replace(/\D/g, '');
    if (!digits) return '';
    const match = queueWallboardCallsRef.current.find(
      (c) => String(c.cid_number || '').replace(/\D/g, '') === digits
    );
    const resolved = match && match.queue ? String(match.queue).split('@')[0] : '';
    // Diagnostic only (kept permanently, not a temp debug hack -- this match has silently
    // failed before with zero visible symptom other than "nothing happens", and there's no way
    // to place a real queue call from this sandboxed dev environment to re-test it directly).
    // If Queue Call Landing stops firing again, open devtools on a real incoming queue call and
    // check this line: an empty `resolved` with a non-empty `wallboard` list means the caller
    // number format doesn't match `cid_number` (e.g. one side has a country code the other
    // doesn't); an empty `wallboard` list means 'queueCallboard' isn't arriving at all this call.
    if (!resolved) {
      console.debug('[QueueCallLanding] no wallboard match for', digits, 'wallboard:',
        queueWallboardCallsRef.current.map((c) => ({ cid_number: c.cid_number, queue: c.queue, state: c.state })));
    }
    return resolved;
  }, []);

  const openCrmLandingTab = useCallback((url, provider) => {
    if (openCallLandingTab(url)) return;
    const name = provider && provider !== 'External URL' ? provider : 'call landing page';
    console.warn('[CallLanding] window.open was blocked for', url);
    toast.error(`Your browser blocked the ${name} pop-up. Allow pop-ups for this site, then it will open on the next call.`, {
      containerId: 'call-landing',
      toastId: 'call-landing-popup-blocked',
      autoClose: 10000,
    });
  }, []);

  const runExtensionCallLanding = useCallback(async (trigger, rawCallerNumber, direction) => {
    const callerNumber = (rawCallerNumber || '').split(' ')[0];
    try {
      const res = await checkContact(trigger === 'ring' ? 1 : 3, '', callerNumber);
      const settings = res.settings || {};
      const contact = res.content || {};
      const callLanding = String(settings.callLanding ?? 'Do Nothing');
      console.debug('[CallLanding] api/contact resolved:', { trigger, direction, callLanding, callLanding2: settings.callLanding2, showContactPageBefore: settings.showContactPageBefore });
      if (isNoCallLanding(callLanding)) return;
      if (!landingEnabledForDirection(direction, settings.callLandingInbound, settings.callLandingOutbound)) return;
      if (!extensionLandingActsOn(trigger, direction, settings.showContactPageBefore)) return;

      const callLanding2 = String(settings.callLanding2 || '');
      const externalUrl = callLandingExternalUrl(settings.showExternalUrl, callerNumber);
      if (opensExternal(callLanding) && CRM_LANDING_OPTIONS.includes(callLanding2) && externalUrl) {
        openCrmLandingTab(externalUrl, callLanding2);
      }

      if (opensLocalContact(callLanding)) {
        setQueueCallLandingInfo({
          queueExtension: '',
          callerNumber,
          contactExisting: !!contact && Object.keys(contact).length > 0,
          contact,
          wrapupCodes: [],
          wrapupNotes: [],
          showWrapUp: false,
          showQueueScript: false,
          queueScript: '',
          hideContactNumber: String(settings.hideContactNumber) === '1',
        });
        setShowQueueCallLandingModal(true);
      }
    } catch (e) {
      console.error('[App] Call Landing check failed:', e);
    }
  }, [openCrmLandingTab]);

  const runQueueCallLanding = useCallback(async (trigger, queueExtension, rawCallerNumber) => {
    const callerNumber = (rawCallerNumber || '').split(' ')[0];
    queueLandingExtRef.current = queueExtension;
    try {
      const res = await checkContact(trigger === 'ring' ? 1 : 3, queueExtension, callerNumber);
      const settings2 = res.settings2 || {};
      const contact = res.content || {};
      const contactExisting = !!contact && Object.keys(contact).length > 0;
      const callLanding = String(settings2.showQueueLading ?? 'Do Nothing');
      // Diagnostic only -- see the matching note in resolveQueueExtensionForNumber. Shows exactly
      // what the queue's own Settings tab resolved to for this trigger, so a "nothing happens"
      // report can be told apart from "resolved to Do Nothing" vs. "resolved to act, but the
      // timing gate below skipped this trigger" vs. "never got this far at all".
      console.debug('[QueueCallLanding] api/contact resolved:', { trigger, queueExtension, callLanding, showQueueWrapup: settings2.showQueueWrapup });
      if (callLanding === 'Do Nothing' || callLanding === 'null' || callLanding === 'undefined') return;

      const callLanding2 = String(settings2.showQueueLading2 || '');
      const externalUrl = callLandingExternalUrl(settings2.showQueueCallLandingUrl, callerNumber);
      const isCrmOption = CRM_LANDING_OPTIONS.includes(callLanding2);

      if (queueCrmTabOpensOn(trigger) && opensExternal(callLanding) && isCrmOption && externalUrl) {
        openCrmLandingTab(externalUrl, callLanding2);
      }

      if (!queueLocalContactActsOn(trigger, settings2.showQueueWrapup)) return;

      if (callLanding === 'Open Local Contact' || callLanding === 'Open Both') {
        setQueueCallLandingInfo({
          queueExtension,
          callerNumber,
          contactExisting,
          contact,
          wrapupCodes: res.wrapupCodes || [],
          wrapupNotes: res.wrapupNotes || [],
          showWrapUp: String(settings2.showQueueWrapup) !== '0',
          showQueueScript: String(settings2.showQueueScript) === '1',
          queueScript: settings2.queueScriptContent || '',
          hideContactNumber: String(settings2.showQueueContact) !== '0',
        });
        setShowQueueCallLandingModal(true);
      }
    } catch (e) {
      console.error('[App] Queue Call Landing check failed:', e);
    }
  }, [openCrmLandingTab]);

  const callLandingKindRef = useRef(null);
  const callLandingFallbackTimersRef = useRef([]);

  const scheduleExtensionLandingFallback = useCallback((trigger, entry) => {
    const timer = setTimeout(() => {
      callLandingFallbackTimersRef.current = callLandingFallbackTimersRef.current.filter((t) => t !== timer);
      if (pendingQueueLandingRef.current[trigger] !== entry) return;
      pendingQueueLandingRef.current[trigger] = null;
      callLandingKindRef.current = 'extension';
      if (isExternalCallerNumber(entry.remoteNumber)) {
        runExtensionCallLanding(trigger, entry.remoteNumber, 'INCOMING');
      }
    }, CALL_LANDING_QUEUE_RESOLVE_GRACE_MS);
    callLandingFallbackTimersRef.current.push(timer);
  }, [runExtensionCallLanding]);

  // Re-attempts any outstanding ring/accept Queue Call Landing trigger -- called both right
  // after a ring/accept event fires (in case the wallboard data already arrived first) and every
  // time fresh wallboard data comes in (in case the SIP event fired first). Whichever notices the
  // match first wins; each trigger fires at most once per call.
  const attemptPendingQueueLanding = useCallback(() => {
    const pending = pendingQueueLandingRef.current;
    if (pending.ring) {
      const remoteNumber = pending.ring.remoteNumber;
      const ext = resolveQueueExtensionForNumber(remoteNumber);
      if (ext) {
        pending.ring = null;
        callLandingKindRef.current = 'queue';
        runQueueCallLanding('ring', ext, remoteNumber);
      }
    }
    if (pending.accept) {
      const remoteNumber = pending.accept.remoteNumber;
      const ext = resolveQueueExtensionForNumber(remoteNumber);
      if (ext) {
        pending.accept = null;
        callLandingKindRef.current = 'queue';
        runQueueCallLanding('accept', ext, remoteNumber);
      }
    }
  }, [resolveQueueExtensionForNumber, runQueueCallLanding]);

  // Subscribe to SIP Service
  useEffect(() => {
    const unsubscribe = sipService.subscribe((regState, callInfo) => {
      setSipRegState(regState);
      setSipCallInfo(callInfo);

      // Sync devices
      setMicrophones(sipService.getMicrophones());
      setSpeakers(sipService.getSpeakers());
      setSelectedDevices(sipService.getSelectedDevices());

      // Auto-open dialer if there is an incoming or outgoing call
      if (callInfo.state !== 'IDLE') {
        setIsDialerOpen(true);
      }

      // Any mid-call overlay (conference, transfer, park, keypad, device
      // picker) must not survive past the call it belonged to, regardless of
      // which one was open and regardless of whether the call ended locally
      // or remotely. Previously this only ran on IDLE, but a call reaches
      // 'ENDED'/'FAILED' first (and stays there briefly to show the "Call
      // Ended" screen) -- sipService itself already clears its own
      // conference/attendedTransfer data on that same transition (see
      // endCall/handleSessionTerminated in sipService.ts), so this mirrors
      // it for the UI-only panel-visibility flags instead of leaving them to
      // whichever panel's own close button the user happens to find.
      if (callInfo.state === 'IDLE' || callInfo.state === 'ENDED' || callInfo.state === 'FAILED') {
        setShowConferencePanel(false);
        setActiveConferenceAddSlot(null);
        setConferenceAddNumber('');
        setConferenceSearchQuery('');
        setShowTransferPopup(false);
        setTransferNumber('');
        setTransferSearchQuery('');
        setShowTransferDialpad(false);
        setShowInCallKeypad(false);
        setShowDeviceSelector(false);
        // Queue Call Landing's popup is deliberately NOT reset here, unlike every other mid-call
        // overlay above -- confirmed against home.dart: `_showContact` is only ever set false by
        // the dialog's own Close/Submit handlers (:17974, :19884, :20146), never by the
        // CALL_INITIATION/ACCEPTED/FAILED/ENDED state handling. Wrap-up notes are real-world
        // post-call work, so the popup is meant to survive the call ending -- auto-closing it here
        // was silently discarding in-progress wrap-up entry before the agent could submit it.
        pendingQueueLandingRef.current = { ring: null, accept: null };
        callLandingFallbackTimersRef.current.forEach(clearTimeout);
        callLandingFallbackTimersRef.current = [];
        callLandingKindRef.current = null;
        queueLandingExtRef.current = '';
      }

      if (callInfo.state === 'IDLE') {
        setDrawerState('collapsed');
        setDragY(0);
        setIsDrawerDragging(false);
        setLocalRecording(false);
      }

      // Incoming-call desktop notification + tab-title alert. Gated on
      // soundService.isRinging (not just state === 'RINGING') so the silent
      // auto-answered attended-transfer-recovery call -- sipService's
      // awaitingTransferRecoveryCall path, which deliberately never rings --
      // doesn't also pop a phantom notification for a call the user was
      // never meant to see ringing.
      const wasRinging = prevCallStateRef.current === 'RINGING';
      const nowGenuinelyRinging = callInfo.state === 'RINGING' && callInfo.direction === 'INCOMING' && soundService.isRinging;
      if (!wasRinging && nowGenuinelyRinging) {
        const callerLabel = callInfo.remoteName && callInfo.remoteName !== callInfo.remoteNumber
          ? `${callInfo.remoteName} (${callInfo.remoteNumber})`
          : (callInfo.remoteNumber || 'Unknown number');
        document.title = `Incoming Call - ${callerLabel}`;

        // Fire regardless of tab focus/visibility -- a phone call is urgent
        // enough to warrant the desktop notification even when the user is
        // already looking at the tab (this matches how Teams/Slack/Zoom
        // handle incoming calls), so it isn't silently skipped in the one
        // scenario (tab focused) most people actually test in.
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            incomingNotificationRef.current?.close();
            const notification = new Notification('Incoming Call - RingQ', {
              body: callerLabel,
              icon: appAsset('images/favicon.png'),
              tag: 'ringq-incoming-call',
              requireInteraction: true,
            });
            notification.onclick = () => {
              window.focus();
              notification.close();
            };
            incomingNotificationRef.current = notification;
          } catch (e) {
            console.warn('[App] Failed to show incoming call notification:', e);
          }
        }
      } else if (wasRinging && callInfo.state !== 'RINGING') {
        document.title = originalTitleRef.current;
        incomingNotificationRef.current?.close();
        incomingNotificationRef.current = null;
      }

      // Queue Call Landing triggers -- 'ring' the moment an incoming queue call starts ringing,
      // 'accept' the moment it's first answered (mirrors home.dart's CALL_INITIATION/ACCEPTED
      // call sites for _checkContact). Both are one-shot per call via prevCallStateRef.
      //
      // Queue extension resolution has two paths, confirmed real by two separate live test calls
      // (see sipService.ts's parseIncomingIdentity): some deployments/call paths embed a
      // "(digits)" marker directly in the caller identity -- sipService already extracts that
      // into callInfo.queueExtension, so when present it's used immediately, synchronously, no
      // wallboard wait needed. Other calls carry no such marker at all (confirmed on a different
      // real call), so the live-wallboard match (resolveQueueExtensionForNumber) remains the
      // fallback for that case -- that feed can arrive a beat before or after the SIP ring/accept
      // event, so an immediate attempt is made and, if it misses, attemptPendingQueueLanding
      // retries on every fresh queueWallboardCalls update until it resolves.
      if (!wasRinging && nowGenuinelyRinging) {
        if (callInfo.queueExtension) {
          callLandingKindRef.current = 'queue';
          runQueueCallLanding('ring', callInfo.queueExtension, callInfo.remoteNumber);
        } else {
          const entry = { remoteNumber: callInfo.remoteNumber };
          pendingQueueLandingRef.current.ring = entry;
          attemptPendingQueueLanding();
          scheduleExtensionLandingFallback('ring', entry);
        }
      }
      const justAnswered = (prevCallStateRef.current === 'RINGING' || prevCallStateRef.current === 'ANSWERING' || prevCallStateRef.current === 'DIALING')
        && callInfo.state === 'ACTIVE' && callInfo.direction === 'INCOMING';
      if (justAnswered) {
        if (callInfo.queueExtension) {
          callLandingKindRef.current = 'queue';
          runQueueCallLanding('accept', callInfo.queueExtension, callInfo.remoteNumber);
        } else if (callLandingKindRef.current === 'queue' && queueLandingExtRef.current) {
          runQueueCallLanding('accept', queueLandingExtRef.current, callInfo.remoteNumber);
        } else if (callLandingKindRef.current === 'extension') {
          if (isExternalCallerNumber(callInfo.remoteNumber)) {
            runExtensionCallLanding('accept', callInfo.remoteNumber, 'INCOMING');
          }
        } else {
          const entry = { remoteNumber: callInfo.remoteNumber };
          pendingQueueLandingRef.current.accept = entry;
          attemptPendingQueueLanding();
          scheduleExtensionLandingFallback('accept', entry);
        }
      }
      const justConnectedOutbound = (prevCallStateRef.current === 'DIALING' || prevCallStateRef.current === 'RINGING')
        && callInfo.state === 'ACTIVE' && callInfo.direction === 'OUTGOING'
        && !callInfo.attendedTransfer?.active;
      if (justConnectedOutbound && isExternalCallerNumber(callInfo.remoteNumber)) {
        callLandingKindRef.current = 'extension';
        runExtensionCallLanding('accept', callInfo.remoteNumber, 'OUTGOING');
      }

      prevCallStateRef.current = callInfo.state;
    });
    return unsubscribe;
  }, [runQueueCallLanding, attemptPendingQueueLanding, runExtensionCallLanding, scheduleExtensionLandingFallback]);

  // Audio-reactive calling animation loop
  useEffect(() => {
    let animFrame;
    const updateRings = () => {
      const outerRing = outerRingRef.current;
      const innerRing = innerRingRef.current;

      if (outerRing || innerRing) {
        const localVol = sipService.getLocalVolume();  // 0 to 1
        const remoteVol = sipService.getRemoteVolume(); // 0 to 1
        const time = Date.now() / 1000;

        if (outerRing) {
          // Remote volume controls outer ring (incoming speak)
          const idleScale = 1.0 + Math.sin(time * 2) * 0.025;
          const scale = idleScale + remoteVol * 0.35;
          const idleOpacity = 0.5 + Math.sin(time * 2) * 0.05;
          const opacity = Math.max(0.15, idleOpacity - remoteVol * 0.2);

          outerRing.style.transform = `scale(${scale})`;
          outerRing.style.opacity = String(opacity);
          // Brand blue stroke that strengthens with volume (no glow -- reads in both themes)
          outerRing.style.border = `1.5px solid rgba(27, 157, 217, ${0.18 + remoteVol * 0.45})`;
          outerRing.style.boxShadow = 'none';
        }

        if (innerRing) {
          // Local volume controls inner ring (my speak)
          const idleScale = 1.0 + Math.sin(time * 3 + 1.5) * 0.035;
          const scale = idleScale + localVol * 0.25;
          const idleOpacity = 0.6 + Math.sin(time * 3 + 1.5) * 0.05;
          const opacity = Math.max(0.2, idleOpacity - localVol * 0.25);

          innerRing.style.transform = `scale(${scale})`;
          innerRing.style.opacity = String(opacity);
          innerRing.style.border = `1.5px solid rgba(27, 157, 217, ${0.28 + localVol * 0.45})`;
          innerRing.style.boxShadow = 'none';
        }
      }

      if (sipCallInfo.state === 'ACTIVE') {
        animFrame = requestAnimationFrame(updateRings);
      }
    };

    if (sipCallInfo.state === 'ACTIVE') {
      animFrame = requestAnimationFrame(updateRings);
    } else {
      // Clear inline styles when not active
      const outerRing = outerRingRef.current;
      const innerRing = innerRingRef.current;
      if (outerRing) {
        outerRing.style.transform = '';
        outerRing.style.opacity = '';
        outerRing.style.border = '';
        outerRing.style.boxShadow = '';
      }
      if (innerRing) {
        innerRing.style.transform = '';
        innerRing.style.opacity = '';
        innerRing.style.border = '';
        innerRing.style.boxShadow = '';
      }
    }

    return () => {
      if (animFrame) {
        cancelAnimationFrame(animFrame);
      }
    };
  }, [sipCallInfo.state]);

  // A session written by a lean sign-in (the Flutter CloudApp signs in with
  // `lean: 1`, and shares localStorage['session'] on this origin) carries no
  // SIP password. Fetch it the way home.dart does -- GET api/sipcredentials --
  // and keep it in memory only, never in the stored session.
  const [sipSecret, setSipSecret] = useState('');
  useEffect(() => {
    if (!isAuthenticated || userSession?.sip_uuid || !(userSession?.extension || userSession?.username)) return;
    let cancelled = false;
    fetch(`${getApiBaseUrl()}/api/sipcredentials`, { credentials: 'include', headers: { Accept: 'application/json' } })
      .then((res) => res.json())
      .then((data) => {
        const password = data?.result === 'success' ? String(data.content?.sip_password || '') : '';
        if (!cancelled && password) setSipSecret(password);
      })
      .catch((err) => console.error('[SIP] Could not load SIP credentials:', err));
    return () => { cancelled = true; };
  }, [isAuthenticated, userSession?.sip_uuid, userSession?.extension, userSession?.username]);
  useEffect(() => { if (!isAuthenticated) setSipSecret(''); }, [isAuthenticated]);
  const sipPassword = userSession?.sip_uuid || sipSecret;

  // Register SIP UA when authenticated
  useEffect(() => {
    if (isAuthenticated && userSession && (userSession.extension || userSession.username) && sipPassword) {
      const apiHost = window.location.hostname;
      const sipUsername = String(userSession.username || '').trim();

      let sipUrl = apiHost;
      let subdomainVal = userSession.subdomain;
      const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(apiHost);

      if (!isIp) {
        const subdomainStr = userSession.subdomain ? String(userSession.subdomain) : '';
        const domainStr = userSession.domain ? String(userSession.domain) : '';

        if (subdomainStr && domainStr) {
          sipUrl = subdomainStr.split(".")[0] + "." + domainStr;
        } else if (subdomainStr) {
          sipUrl = subdomainStr;
        } else if (domainStr) {
          sipUrl = domainStr;
        } else {
          sipUrl = apiHost;
        }

        if (!subdomainVal) {
          subdomainVal = domainStr || apiHost;
        }
      }

      sipService.register({
        username: sipUsername,
        sipUuid: sipPassword,
        subdomain: subdomainVal || apiHost,
        domain: userSession.domain || apiHost,
        sipUrl: sipUrl,
        displayName: userSession.firstname ? `${userSession.firstname} ${userSession.lastname || ''}`.trim() : sipUsername
      });
    } else {
      // unregister() (not stop()) so this also clears sipService's stored credentials and
      // marks the drop as intentional -- otherwise every other place that flips
      // isAuthenticated to false without going through handleLogout (e.g. a rejected/expired
      // session at fetchDashboardData's own api/index check) would leave the reconnect-on-
      // visibility/online listeners armed to keep re-registering a session that's no longer
      // valid server-side.
      sipService.unregister();
    }
  }, [isAuthenticated, userSession, sipPassword]);

  // Active page inside router -- driven by the URL (via react-router) instead
  // of plain useState, so navigating actually updates the address bar and
  // supports back/forward/refresh. `activePageRef` mirrors the latest value
  // on every render so `setActivePage` (kept stable, like a real useState
  // setter, so every existing closure across this file keeps working) can
  // always read the true current page instead of a stale closed-over one.
  const location = useLocation();
  const navigate = useNavigate();
  // Anything after the page's own path is that page's inner screen (see
  // router/useSubRoute.js), e.g. /extensions/1003 is still page '3'.
  const { id: activePage, base: activePageBase, rest: activePageRest } = resolvePagePath(location.pathname);
  const activePageRef = useRef(activePage);
  activePageRef.current = activePage;
  const setActivePage = useCallback((next) => {
    const current = activePageRef.current;
    const nextId = typeof next === 'function' ? next(current) : next;
    if (nextId === current) return;
    navigate(ID_TO_PATH[nextId] || ID_TO_PATH[DEFAULT_PAGE_ID]);
  }, [navigate]);

  // Sidebar clicks: picking the page you're already on takes it back to its
  // home screen -- drops any inner-screen path from the URL and remounts the
  // page (pageResetKey), so screens still kept in component state reset too.
  // Before, this was a no-op and the only way out of an inner screen was Back.
  const [pageResetKey, setPageResetKey] = useState(0);
  const activePageLocationRef = useRef({ base: activePageBase, rest: activePageRest });
  activePageLocationRef.current = { base: activePageBase, rest: activePageRest };
  const selectPageFromMenu = useCallback((id) => {
    if (id !== activePageRef.current) {
      setActivePage(id);
      return;
    }
    const { base, rest } = activePageLocationRef.current;
    if (rest) navigate(base);
    setPageResetKey((k) => k + 1);
  }, [navigate, setActivePage]);

  // Queue / Others forms opened from the Call Flow canvas live in the URL --
  // /call-flow/queue/new, /call-flow/queue/<ext>, /call-flow/others/new,
  // /call-flow/others/<conference|fax>/<ext> -- so refresh keeps the form open
  // and Back (or Save / Cancel) returns to the canvas.
  const openQueueModule = (view, extension = null) => {
    const sub = view === 'add' ? 'new' : view === 'edit' && extension ? encodeURIComponent(String(extension)) : '';
    navigate(sub ? `${ID_TO_PATH['12-queue']}/${sub}` : ID_TO_PATH['12-queue'], { state: { subFrom: location.pathname } });
  };
  const openOthersModule = (view, type = null, extension = null) => {
    const sub = view === 'edit' && type && extension ? `${type}/${encodeURIComponent(String(extension))}` : 'new';
    navigate(`${ID_TO_PATH['12-others']}/${sub}`, { state: { subFrom: location.pathname } });
  };
  // Leaving a Queue / Others form: step Back when we came from the canvas, so
  // history doesn't grow canvas -> form -> canvas; otherwise (refreshed or
  // deep-linked form) replace it with the canvas.
  const exitToCallFlow = () => {
    if (location.state?.subFrom === ID_TO_PATH['12']) navigate(-1);
    else navigate(ID_TO_PATH['12'], { replace: true });
  };

  // Login form input states
  const [loginTab, setLoginTab] = useState(0); // 0 = Access Code, 1 = SSO QR, 2 = SSO Code, 3 = Password
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [accessCodeSent, setAccessCodeSent] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [qrCodeData, setQrCodeData] = useState('');

  // Check session on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    const verifyParam = params.get('verify');
    const recoverParam = params.get('recover');
    const savedSession = readStoredSession();
    const API_BASE = getApiBaseUrl();

    if (savedSession && !verifyParam && !recoverParam) {
      try {
        const parsed = savedSession;
        setUserSession(parsed);
        if (parsed.permissionMode) {
          setPermissionMode(parseInt(parsed.permissionMode));
        }
        setIsAuthenticated(true);
        // Session is already valid locally — /accounts only feeds the login page, so don't block on it
        setAuthLoading(false);
      } catch (err) {
        console.error("Failed to parse saved session", err);
      }

      fetch(`${API_BASE}/accounts`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.result === 'success') {
            setWebPassword2(data.content === 1 || data.content === '1' || data.content === null || data.content === 'null');
            if (data.whiteLabelLogo) setWhiteLabelLogo(data.whiteLabelLogo);
          }
        })
        .catch(err => console.error(err))
        .finally(() => setAuthLoading(false));
    } else {
      if (verifyParam && emailParam) {
        setAuthLoading(true);
        fetch(`${API_BASE}/register/verify/${verifyParam}/${emailParam}`, { credentials: 'include' })
          .then(res => res.json())
          .then(data => {
            if (data.result === 'success') {
              setUserSession(data.content);
              localStorage.setItem('session', JSON.stringify(data.content));
              if (data.content.permissionMode) {
                setPermissionMode(parseInt(data.content.permissionMode));
              }
              setIsAuthenticated(true);
            } else {
              setAuthError(data.message || 'Verification failed');
            }
          })
          .catch(err => setAuthError('Network error during verification'))
          .finally(() => setAuthLoading(false));
      } else if (recoverParam && emailParam) {
        setAuthLoading(true);
        fetch(`${API_BASE}/login/forgot/${recoverParam}/${emailParam}`, { credentials: 'include' })
          .then(res => res.json())
          .then(data => {
            if (data.result === 'success') {
              setUserSession(data.content);
              localStorage.setItem('session', JSON.stringify(data.content));
              if (data.content.permissionMode) {
                setPermissionMode(parseInt(data.content.permissionMode));
              }
              setIsAuthenticated(true);
            } else {
              setAuthError(data.message || 'Recovery login failed');
            }
          })
          .catch(err => setAuthError('Network error during recovery login'))
          .finally(() => setAuthLoading(false));
      } else {
        setAuthLoading(true);
        fetch(`${API_BASE}/accounts`, { credentials: 'include' })
          .then(res => res.json())
          .then(data => {
            if (data.result === 'success') {
              setWebPassword2(data.content === 1 || data.content === '1' || data.content === null || data.content === 'null');
              if (data.whiteLabelLogo) setWhiteLabelLogo(data.whiteLabelLogo);
            } else {
              window.location.href = "https://www.ringq.com";
            }
          })
          .catch(err => console.error("Accounts load error", err))
          .finally(() => setAuthLoading(false));
      }
    }
  }, []);

  // Login handler functions
  const handleRequestAccessCode = (e) => {
    e.preventDefault();
    if (!loginEmail) {
      setAuthError("Please enter email address.");
      return;
    }
    setSubmitting(true);
    setAuthError('');
    setAuthSuccess('');

    const API_BASE = getApiBaseUrl();
    fetch(`${API_BASE}/login/recover`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        type: '0',
        email: loginEmail.toLowerCase()
      }),
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        if (data.result === 'success') {
          setAccessCodeSent(true);
          setAuthSuccess(data.message || "Access code sent to your email.");
        } else {
          setAuthError(data.message || "Failed to send access code.");
        }
      })
      .catch(err => setAuthError("Network error. Please try again."))
      .finally(() => setSubmitting(false));
  };

  const handleVerifyAccessCode = (e) => {
    e.preventDefault();
    if (!loginEmail || !accessCode) {
      setAuthError("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    setAuthError('');

    const API_BASE = getApiBaseUrl();
    fetch(`${API_BASE}/login/forgot/${accessCode}/${loginEmail.toLowerCase()}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.result === 'success') {
          setUserSession(data.content);
          localStorage.setItem('session', JSON.stringify(data.content));
          if (data.content.permissionMode) {
            setPermissionMode(parseInt(data.content.permissionMode));
          }
          setIsAuthenticated(true);
        } else {
          setAuthError(data.message || "Invalid access code.");
        }
      })
      .catch(err => setAuthError("Network error. Please try again."))
      .finally(() => setSubmitting(false));
  };

  const handlePasswordLogin = (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setAuthError("Please enter email and password.");
      return;
    }
    setSubmitting(true);
    setAuthError('');

    const API_BASE = getApiBaseUrl();
    fetch(`${API_BASE}/login/forgot`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: loginEmail.toLowerCase(),
        password: loginPassword
      }),
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        if (data.result === 'success') {
          setUserSession(data.content);
          localStorage.setItem('session', JSON.stringify(data.content));
          if (data.content.permissionMode) {
            setPermissionMode(parseInt(data.content.permissionMode));
          }
          setIsAuthenticated(true);
        } else {
          setAuthError(data.message || "Invalid credentials.");
        }
      })
      .catch(err => setAuthError("Network error. Please try again."))
      .finally(() => setSubmitting(false));
  };

  const handleSsoCodeLogin = (e) => {
    e.preventDefault();
    if (!loginEmail) {
      setAuthError("Please enter SSO parameters.");
      return;
    }
    setSubmitting(true);
    setAuthError('');

    const API_BASE = getApiBaseUrl();
    fetch(`${API_BASE}/accounts`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        parameters: loginEmail
      }),
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        if (data.result === 'success') {
          setQrCodeData(data.content);
          setAuthSuccess("SSO Code accepted.");
        } else {
          setAuthError(data.message || "SSO Code error.");
        }
      })
      .catch(err => setAuthError("Network error."))
      .finally(() => setSubmitting(false));
  };

  // home.dart:1600-1607/2753-2783 mutate `session` directly on a successful
  // profile/avatar save so header + profile stay in sync immediately, no
  // refetch. Mirrors that: merge into userSession state + the persisted copy.
  const handleProfileSessionUpdate = (fields) => {
    setUserSession(prev => {
      const next = { ...prev, ...fields };
      try {
        const saved = readStoredSession();
        const merged = saved ? { ...saved, ...fields } : next;
        localStorage.setItem('session', JSON.stringify(merged));
      } catch { /* ignore */ }
      // Team Directory / Dialer read avatars & names off the `extensions` array, not
      // userSession -- update the signed-in user's extension record immediately so
      // every screen (Team Directory, Extension Page, Dialer, Profile) stays in sync.
      setExtensions(prevExt => prevExt.map(ext =>
        String(ext.extension) === String(prev.extension)
          ? {
            ...ext,
            ...fields,
            ...(fields.firstname !== undefined || fields.lastname !== undefined ? {
              firstname: fields.firstname ?? ext.firstname,
              lastname: fields.lastname ?? ext.lastname,
              agent_name: `${fields.firstname ?? ext.firstname ?? ''} ${fields.lastname ?? ext.lastname ?? ''}`.trim(),
              directory_name: `${fields.firstname ?? ext.firstname ?? ''} ${fields.lastname ?? ext.lastname ?? ''}`.trim(),
              name: `${fields.firstname ?? ext.firstname ?? ''} ${fields.lastname ?? ext.lastname ?? ''}`.trim(),
            } : null)
          }
          : ext
      ));
      return next;
    });
  };

  // extensions.dart:1590-1637 (_postDevice) -- Flutter mutates its own local device list
  // (remove on delete, flip `enabled` on toggle) the instant the POST succeeds, never waiting on
  // a separate refetch. MyProfilePage.tsx's own postDevice only called onDataChanged (a full
  // bootstrap refetch) and relied on that to eventually flow a new `devices` prop back down --
  // own request: deleting/toggling a device should be immediate, not need a page refresh.
  const handleDeviceChanged = (deviceId, patch) => {
    setDevices(prev =>
      patch.remove
        ? prev.filter(d => String(d.id) !== String(deviceId))
        : prev.map(d => (String(d.id) === String(deviceId) ? { ...d, enabled: patch.enabled } : d))
    );
  };

  const handleLogout = () => {
    // Without this, sipService (a singleton, not tied to React's lifecycle) kept its WebSocket
    // registered straight through logout -- and, after the reconnect-on-visibility fix above,
    // would have gone on re-registering that now-logged-out session's credentials indefinitely
    // any time the tab regained focus.
    sipService.unregister();
    const API_BASE = getApiBaseUrl();
    fetch(`${API_BASE}/accounts/logout/reactapp/reacttoken`, { credentials: 'include' })
      .finally(() => {
        localStorage.removeItem('session');
        clearDirectoryCache();
        clearChatMessageCaches();
        setUserSession({});
        setIsAuthenticated(false);
        setActivePage('0');
      });
  };

  // [ext-access] an admin switched this extension off, or removed its Webapp access: sign out now
  // (signal.js 'accessChanged', or the next dashboard refresh) with the reason on the login screen.
  const handleLogoutRef = useRef(handleLogout);
  handleLogoutRef.current = handleLogout;
  const forceSignOutRef = useRef(null);
  forceSignOutRef.current = (message) => {
    setAuthError(message);
    handleLogoutRef.current();
  };

  // Clear Cache header button -- matches Flutter's _clearCache (home.dart:3773-3797):
  // GET api/clearcache, then a 6s-delayed full reload on success.
  const handleConfirmClearCache = () => {
    setShowClearCacheDialog(false);
    setClearCacheError('');
    const API_BASE = getApiBaseUrl();
    fetch(`${API_BASE}/api/clearcache`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.result === 'success') {
          const parsed = readStoredSession();
          if (parsed) {
            try {
              parsed.navigateToCallFlow = '1';
              localStorage.setItem('session', JSON.stringify(parsed));
            } catch { /* ignore */ }
          }
          setTimeout(() => window.location.reload(), 6000);
        } else {
          setClearCacheError(data.message || 'Failed to clear cache.');
        }
      })
      .catch(() => setClearCacheError('Network error while clearing cache.'));
  };

  // Desktop App header button -- matches Flutter's _openDesktopApp
  // (home.dart:4027-4062): POST desktop/autologintoken, hand off to the
  // ringq:// custom URL scheme, fall back to a download dialog if the OS
  // didn't catch it within 2.5s.
  const handleOpenDesktopApp = () => {
    if (isOpeningDesktop) return;
    setIsOpeningDesktop(true);
    const API_BASE = getApiBaseUrl();
    fetch(`${API_BASE}/desktop/autologintoken`, { method: 'POST', credentials: 'include' })
      .then(res => res.json())
      .then(body => {
        if (body.result !== 'success') return;
        const token = body.token;
        const domain = userSession.subdomain || getApiHost();
        window.open(`ringq://autologin?token=${token}&domain=${domain}`, '_self');
        setTimeout(() => setShowDesktopDownloadDialog(true), 2500);
      })
      .catch(() => { })
      .finally(() => setIsOpeningDesktop(false));
  };

  const handleDownloadWindows = () => {
    window.open('https://apps.microsoft.com/detail/9mvnmt2w4nl6?hl=en-GB&gl=SG', '_blank', 'noopener,noreferrer');
    setShowDesktopDownloadDialog(false);
  };

  // Language header menu -- matches Flutter's onSelected (home.dart:4982-4985):
  // changeLocale (now real for the sidebar/header chrome via
  // src/i18n/navTranslations.js -- per-page content is a separate, larger
  // follow-up, tracked in MIGRATION_PLAN.md) plus the real fire-and-forget
  // preference-save call.
  const [activeLanguage, setActiveLanguage] = useState(() => {
    try { return localStorage.getItem('app_locale') || 'en'; } catch { return 'en'; }
  });
  const t = useCallback((text) => translateNav(text, activeLanguage), [activeLanguage]);

  useEffect(() => {
    document.documentElement.dir = RTL_LANGUAGES.includes(activeLanguage) ? 'rtl' : 'ltr';
  }, [activeLanguage]);

  const handleSelectLanguage = (code) => {
    setShowLangMenu(false);
    setActiveLanguage(code);
    try { localStorage.setItem('app_locale', code); } catch { /* ignore */ }
    const API_BASE = getApiBaseUrl();
    fetch(`${API_BASE}/language/language`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ locale: code }),
    }).catch(() => { });
  };

  // HEADER_LANGUAGES now lives in src/i18n/navTranslations.js -- shared with
  // GlobalSettings' "Language & Office Hours" page so both pickers offer the
  // exact same language list.
  const getPrimaryMenus = (permOverride) => {
    const menus = [];
    // RingQ Tenant Menu & Global Settings Access doc -- Main Tenant (the
    // multi-tenant license owner account; internal roles Owner/L1/L2/Partner
    // collapse to one access level, no new permission tier) gets its own
    // fixed menu, checked before permissionMode -- same placement/pattern as
    // the existing multiTenantLicenseOwner short-circuit in
    // getSecondaryMenus below, and deliberately not gated on
    // permOverride/perm for the same reason that one isn't: this must hold
    // regardless of which permissionMode value this account happens to carry.
    if (multiTenantLicenseOwner) {
      menus.push({ title: "Dashboard", icon: "bx bx-home-alt", routePath: "0" });
      menus.push({ title: "Users", icon: "bx bx-user", routePath: "3" });
      menus.push({ title: "User Roles", icon: "bx bx-user-check", routePath: "23" });
      // TODO(billing-port): doc also lists "Billing" here. No React Billing
      // page exists yet (Flutter-only: lib/pages/billing.dart,
      // billinghistory.dart, billings.dart) -- omitted pending a dedicated
      // follow-up port rather than built as a stub.
      return menus;
    }
    const perm = parseInt(permOverride ?? permissionMode) || 7;
    if (perm === 7) {
      // home.dart:17099 -- Dashboard is gated on singleInstance for Owner
      // specifically (Manager/Supervisor/Agent below always show it,
      // ported as-is even though that asymmetry looks accidental in the
      // Dart source -- not this pass's call to silently "fix").
      if (singleInstance) {
        menus.push({ title: "Dashboard", icon: "bx bx-home-alt", routePath: "0" });
      }
      menus.push({ title: "Team Directory", icon: "bx bx-user", routePath: "24" });
      menus.push({
        title: "Accounts",
        icon: "bx bx-id-card",
        routePath: "3",
        children: [
          { title: "Extensions", icon: "bx bx-user", routePath: "3" },
          ...(hotelFrontDeskMenuEnabled ? [{ title: "Hotel Front Desk", icon: "bx bx-building-house", routePath: "31" }] : []),
          { title: "Connections", icon: "bx bx-phone", routePath: "2" },
          { title: "User Roles", icon: "bx bx-user-check", routePath: "23" },
          { title: "Voice Mails", icon: "bx bx-voicemail", routePath: "4" }
        ]
      });
      if (enableContactPage) {
        menus.push({
          title: "Contact Center",
          icon: "bx bx-phone-call",
          routePath: "5",
          children: [
            { title: "Contacts", icon: "bx bx-book-open", routePath: "5" }
          ]
        });
      }
      menus.push({ title: "Wallboard", icon: "bx bx-window", routePath: "6" });
      menus.push({
        title: "Digital Channels",
        icon: "bx bx-chat",
        routePath: "22",
        children: [
          { title: "Chat", icon: "bx bx-message-rounded-dots", routePath: "22" },
          { title: "eFax", icon: "bx bx-printer", routePath: "30" },
          { title: "SMS", icon: "bx bx-envelope", routePath: "9" }
        ]
      });
    } else if (perm === 8) {
      menus.push({ title: "Dashboard", icon: "bx bx-home-alt", routePath: "0" });
      menus.push({
        title: "Accounts",
        icon: "bx bx-id-card",
        routePath: "3",
        children: [
          { title: "Extensions", icon: "bx bx-user", routePath: "3" },
          ...(hotelFrontDeskMenuEnabled ? [{ title: "Hotel Front Desk", icon: "bx bx-building-house", routePath: "31" }] : []),
          { title: "Connections", icon: "bx bx-phone", routePath: "2" },
          { title: "Voice Mails", icon: "bx bx-voicemail", routePath: "4" }
        ]
      });
      if (enableContactPage) {
        menus.push({
          title: "Contact Center",
          icon: "bx bx-phone-call",
          routePath: "5",
          children: [
            { title: "Contacts", icon: "bx bx-book-open", routePath: "5" }
          ]
        });
      }
      menus.push({ title: "Wallboard", icon: "bx bx-window", routePath: "6" });
      menus.push({
        title: "Digital Channels",
        icon: "bx bx-chat",
        routePath: "22",
        children: [
          { title: "Chat", icon: "bx bx-message-rounded-dots", routePath: "22" },
          { title: "eFax", icon: "bx bx-printer", routePath: "30" },
          { title: "SMS", icon: "bx bx-envelope", routePath: "9" }
        ]
      });
    } else if (perm === 9) {
      menus.push({ title: "Dashboard", icon: "bx bx-home-alt", routePath: "0" });
      menus.push({ title: "Team Directory", icon: "bx bx-user", routePath: "24" });
      menus.push({
        title: "Accounts",
        icon: "bx bx-id-card",
        routePath: "3",
        children: [
          { title: "Extensions", icon: "bx bx-user", routePath: "3" },
          ...(hotelFrontDeskMenuEnabled ? [{ title: "Hotel Front Desk", icon: "bx bx-building-house", routePath: "31" }] : []),
          { title: "Connections", icon: "bx bx-phone", routePath: "2" },
          { title: "User Roles", icon: "bx bx-user-check", routePath: "23" },
          { title: "Voice Mails", icon: "bx bx-voicemail", routePath: "4" }
        ]
      });
      if (enableContactPage) {
        menus.push({
          title: "Contact Center",
          icon: "bx bx-phone-call",
          routePath: "5",
          children: [
            { title: "Contacts", icon: "bx bx-book-open", routePath: "5" },
            { title: "Wallboard", icon: "bx bx-window", routePath: "6" }
          ]
        });
      }
      menus.push({
        title: "Digital Channels",
        icon: "bx bx-chat",
        routePath: "22",
        children: [
          { title: "Chat", icon: "bx bx-message-rounded-dots", routePath: "22" },
          { title: "eFax", icon: "bx bx-printer", routePath: "30" },
        ]
      });
    } else if (perm === 10) {
      // [user-role] Users land on the Team Directory; no Dashboard (system-wide numbers)
      menus.push({ title: "Team Directory", icon: "bx bx-user", routePath: "24" });
      menus.push({ title: "Contacts", icon: "bx bx-book-open", routePath: "5" });
      menus.push({ title: "Calls", icon: "bx bx-phone", routePath: "7" });
      menus.push({ title: "Voice Mails", icon: "bx bx-voicemail", routePath: "4" });
      menus.push({
        title: "Digital Channels",
        icon: "bx bx-chat",
        routePath: "22",
        children: [
          { title: "Chat", icon: "bx bx-message-rounded-dots", routePath: "22" }
        ]
      });
    } else if (perm === 11) {
      menus.push({ title: "Team Directory", icon: "bx bx-user", routePath: "24" });
      menus.push({ title: "Wallboard", icon: "bx bx-window", routePath: "6" });
      menus.push({ title: "Reports", icon: "bx bx-file", routePath: "13" });
    }
    return menus;
  };

  const getSecondaryMenus = (permOverride) => {
    const menus = [];
    // home.dart:17430 -- checked before permissionMode, not inside its perm===7
    // branch: the actual multi-tenant license owner (Main Tenant) gets a
    // reduced menu regardless of permissionMode/internal role, losing
    // Chameleon and Call Flow entirely. Global Settings is a flat top-level
    // item here (not nested under a "Settings" parent) per the RingQ Tenant
    // Menu & Global Settings Access doc; Dashboard/Users/User Roles for this
    // account live in the matching multiTenantLicenseOwner branch of
    // getPrimaryMenus above. A Sub Admin with the identical permissionMode
    // (7) but a different email than the license owner falls through to the
    // normal branch below untouched.
    if (multiTenantLicenseOwner) {
      menus.push({ title: "Global Settings", icon: "bx bx-globe", routePath: "19" });
      return menus;
    }
    const perm = parseInt(permOverride ?? permissionMode) || 7;
    if (perm === 7) {
      menus.push({ title: "Chameleon", icon: "bx bx-palette", routePath: "20" });
      menus.push({ title: "Call Flow", icon: "bx bx-sitemap", routePath: "12" });
      menus.push({ title: "Global Settings", icon: "bx bx-globe", routePath: "19" });
      menus.push({
        title: "Help",
        icon: "bx bx-help-circle",
        routePath: "28",
        children: [
          { title: "Guides", icon: "bx bx-file", externalUrl: "https://www.ringq.com/guides" },
          { title: "Video Guides", icon: "bx bx-play-circle", onSelect: () => setIsVideoTutorialModalOpen(true) }
        ]
      });
      menus.push({ title: "Apps", icon: "bx bx-grid-alt", routePath: "29" });
    } else if (perm === 8) {
      menus.push({ title: "Call Flow", icon: "bx bx-sitemap", routePath: "12" });
      menus.push({ title: "Global Settings", icon: "bx bx-globe", routePath: "19" });
      menus.push({
        title: "Help",
        icon: "bx bx-help-circle",
        routePath: "28",
        children: [
          { title: "Guides", icon: "bx bx-file", externalUrl: "https://www.ringq.com/guides" },
          { title: "Video Guides", icon: "bx bx-play-circle", onSelect: () => setIsVideoTutorialModalOpen(true) }
        ]
      });
      menus.push({ title: "Apps", icon: "bx bx-grid-alt", routePath: "29" });
    } else if (perm === 10 || perm === 11) {
      menus.push({
        title: "Help",
        icon: "bx bx-help-circle",
        routePath: "28",
        children: [
          { title: "Guides", icon: "bx bx-file", externalUrl: "https://www.ringq.com/guides" },
          { title: "Video Guides", icon: "bx bx-play-circle", onSelect: () => setIsVideoTutorialModalOpen(true) }
        ]
      });
      menus.push({ title: "Apps", icon: "bx bx-grid-alt", routePath: "29" });
    }
    return menus;
  };

  // Navigation & theme states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // App-wide search (sidebar "Search" button / Ctrl+K or Cmd+K).
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // A Global Settings card picked from search: GlobalSettings opens it when
  // this changes (nonce), and it's cleared once you leave that page.
  const [globalSettingRequest, setGlobalSettingRequest] = useState(null);
  useEffect(() => {
    if (activePage !== '19') setGlobalSettingRequest(null);
  }, [activePage]);
  // Same idea for the Extensions page's Extensions / Groups tab.
  const [extensionsTabRequest, setExtensionsTabRequest] = useState(null);
  const isMacPlatform = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Daylight (light) is the default theme; a saved choice still wins.
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('isDarkMode');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('isDarkMode', JSON.stringify(next));
      return next;
    });
  };

  // Three themes, picked from the topbar theme menu:
  //   Daylight = light, Twilight = the classic navy dark, Midnight = the
  //   blue-slate dark (.theme-slate in App.css). Internal ids stay
  //   'light' / 'dark' / 'slate'. Midnight is a dark theme, so isDarkMode
  //   stays true under it and every existing dark-mode check keeps working.
  const [isSlateTheme, setIsSlateTheme] = useState(() => {
    try { return localStorage.getItem('ringq.theme') === 'slate'; } catch { return false; }
  });
  const themeMode = !isDarkMode ? 'light' : isSlateTheme ? 'slate' : 'dark';
  const setThemeMode = (mode) => {
    const dark = mode !== 'light';
    setIsDarkMode(dark);
    setIsSlateTheme(mode === 'slate');
    try {
      localStorage.setItem('isDarkMode', JSON.stringify(dark));
      localStorage.setItem('ringq.theme', mode);
    } catch { /* storage blocked -- theme just won't persist */ }
  };

  // The `.light-mode` class that drives the Untitled UI base components'
  // (Select, Popover, etc.) light/dark CSS variables only lives on
  // `.app-container` -- but those components render their overlays (the
  // Select popover's listbox, in particular) via a React Aria portal
  // straight into `document.body`, which is a *sibling* of `.app-container`,
  // not a descendant. A class scoped to `.app-container` never reaches a
  // sibling, so those portaled overlays always fell back to the dark
  // defaults regardless of the app's actual theme. Mirroring the class onto
  // `document.body` too puts it back in scope for both.
  useEffect(() => {
    document.body.classList.toggle('light-mode', !isDarkMode);
    // Same reason for the slate theme's tokens (portaled menus/dialogs)
    document.body.classList.toggle('theme-slate', themeMode === 'slate');
  }, [isDarkMode, themeMode]);

  // Video Tutorial Modals State
  const [isVideoTutorialModalOpen, setIsVideoTutorialModalOpen] = useState(false);

  // Overlays
  const [isDialerOpen, setIsDialerOpen] = useState(window.innerWidth <= 768);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  // Dialer
  // Backs the pre-dial keypad's number field -- never auto-focused (so its
  // native caret/the app's global `input:focus` glow only show up when the
  // user deliberately clicks in to edit), but still needs a ref so the
  // global keydown capture below can tell whether it's the one actually
  // focused right now.

  // Live call history -- dialer.dart's GET api/history/{type}/{page}, type 1
  // = All (_callLogs), type 2 = Missed (_callLogs2). Missed is fetched lazily
  // the first time that sub-tab is opened (matches dialer.dart's _initial2
  // guard); All is refetched fresh every time the History nav icon is
  // tapped (matches dialer.dart's bottom-nav phone icon handler, which
  // resets _page/_callLogs before calling _initialize2(1, ...) again).

  // Live voicemails -- dialer.dart's GET api/voicemails/{page}/2.

  // Contacts tab -- dialer.dart's _tabController3: "Company" is the full
  // extensions directory, "Team" (despite the label) is _favoriteEntries.
  const [expandedMenus, setExpandedMenus] = useState({});
  const handleToggleSidebarMenu = (menuTitle) => {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
      setExpandedMenus(prev => ({ ...prev, [menuTitle]: true }));
    } else {
      setExpandedMenus(prev => ({ ...prev, [menuTitle]: !prev[menuTitle] }));
    }
  };
  const [callStatusTab, setCallStatusTab] = useState('active'); // 'active' | 'failed' | 'online'
  const [callStatusSearch, setCallStatusSearch] = useState('');

  // Auto-expand parent menu when activePage changes
  useEffect(() => {
    const allMenus = [...getPrimaryMenus(), ...getSecondaryMenus()];
    const activeParent = allMenus.find(menu =>
      menu.children && menu.children.some(c => c.routePath === activePage)
    );
    if (activeParent) {
      setExpandedMenus(prev => ({
        ...prev,
        [activeParent.title]: true
      }));
    }
  }, [activePage, permissionMode]);

  // [user-role] a User (permission 10) has no Dashboard: anything that lands there (login, logo,
  // an old link) goes to the Team Directory instead.
  useEffect(() => {
    if (parseInt(permissionMode, 10) === 10 && String(activePage).split('-')[0] === '0') setActivePage('24');
  }, [activePage, permissionMode, setActivePage]);


  // Confirmation shown before logging into a queue (turning a row's toggle
  // to Available) -- matches dialer.dart's per-row AwesomeDialog ("Queue
  // Login" / "Are you sure you want to login to the queue?"); logging out
  // needs no confirmation, same as Flutter. Holds the target row's
  // {queueExtension, agentUuid} while the dialog is open, applied on Submit.
  const [queueLoginConfirmTarget, setQueueLoginConfirmTarget] = useState(null);

  // Confirmation shown before clearing call history -- same styled dialog
  // pattern as the queue login confirm above (matches dialer.dart's own
  // showGeneralDialog before _postDelete()), rather than a native confirm().
  const [isClearLogsConfirmOpen, setIsClearLogsConfirmOpen] = useState(false);

  // Dialer widget's own Settings tab (dialer.dart:4710-4847) -- the info
  // icon opens a small dialog with a (permanently blank in Flutter) "Cloud
  // Instance Name" row and a hardcoded "Permission: user" row.
  // Portal target for that dialog -- `.dialer-settings-info-overlay` needs
  // to center against the WHOLE dialer widget, not whichever inner tab
  // container happens to be its DOM parent (dialer-screen-settings has its
  // own `position: relative` for an unrelated reason, which would silently
  // become the containing block -- and shrink the overlay down to that
  // small profile-row-sized box -- if the dialog were left as a plain,
  // non-portalled child there instead of targeting this ref directly).

  // Dialer Settings tab's "Audio Settings" section -- own request, no Flutter
  // equivalent (same as the rest of this Settings tab's info dialog and the
  // Custom Dialer modal elsewhere in this file). Device selection itself
  // reuses sipService's existing microphones/speakers/selectedDevices state
  // (already wired for the in-call quick panel); this adds Test Mic (a live
  // input-level meter off a standalone getUserMedia stream, not tied to a
  // call), Test Speaker, and a persistent ringtone choice.




  // Real mic/speaker names only become visible once permission has been granted at least once
  // (browser privacy behavior, not a bug in the previous device list) -- prime it the moment the
  // agent actually opens this section, a reasonable point for a permission prompt.



  // Dashboard's "topology-outline-btn" (Extensions panel, per explicit
  // request) reuses the exact same Capture feature as Settings -> Global ->
  // Troubleshooting -> Capture -- same self-contained CaptureModal,
  // GlobalSettings.tsx's own `showCaptureModal`/`setShowCaptureModal(true)`
  // pattern.
  const [showDashboardCaptureModal, setShowDashboardCaptureModal] = useState(false);

  // Footer's version text / "Previous Builds" link -- both were dead before
  // (hardcoded version string, a `#previous` anchor with no handler).
  const [showPreviousBuildsPage, setShowPreviousBuildsPage] = useState(false);

  // Dynamic Aux Code States ported from Flutter home.dart
  const [auxcodes, setAuxcodes] = useState([]);
  const [auxcodeStatus, setAuxcodeStatus] = useState('');
  const [agentuuid, setAgentuuid] = useState('');
  const [agentuuids, setAgentuuids] = useState([]);
  const [queueLogIn, setQueueLogIn] = useState(false);
  // agentuuids starts empty and is only populated once the async
  // api/auxcodes call resolves -- without this flag, the Call Profiles
  // header button (agentuuids.length === 0) briefly renders on every load
  // for queue-agent extensions too, then flashes to the Aux Code toggle a
  // moment later once the real data arrives. Previously that slot was just
  // blank during the same window, so the flash is a regression the Call
  // Profiles feature introduced -- gate the profile button on this instead
  // of racing the fetch.
  const [agentuuidsLoaded, setAgentuuidsLoaded] = useState(false);
  // Per-queue-membership-uuid -> queue_extension (api/index `agents4`), and
  // that same uuid -> its own live Available/Aux status (api/index
  // `wallAuxcodes`, kept fresh via the 'status' socket event) -- lets the
  // Aux Codes panel show/drive one independently-toggleable row per queue,
  // matching Flutter's dialer.dart per-queue ListView. Verified against the
  // production app (team.ringq.ai/cloudapp) that this per-queue status IS
  // genuinely tracked server-side (two queues showed different values on a
  // fresh load) -- but toggling a row there is itself only an optimistic
  // local update that doesn't reliably persist through a refresh either, so
  // this mirrors that same optimistic behavior rather than pretending to be
  // more reliable than the reference implementation actually is.
  const [wallQueueAssignments, setWallQueueAssignments] = useState({});
  const [wallAuxStatuses, setWallAuxStatuses] = useState({});
  // {extension: statusCode} -- matches Flutter's `wallStatus` map
  // (assets.dart:666, home.dart:2830), a SIP-registration signal distinct
  // from wallAuxStatuses' aux-code selection: an agent can have aux code
  // "Available" but still be registration-offline (device unplugged/no
  // softphone open), which is exactly what this overrides to "Offline" in
  // the Wallboard's Agent Details (see the 'status' handler below and
  // AdvancedWallboard.tsx). Only ever populated live (no bootstrap seed --
  // Flutter's own `wallStatus` starts empty too, home.dart:666).
  const [wallStatus, setWallStatus] = useState({});
  // Latest-value refs for use inside the long-lived socket 'status' handler
  // below, which is attached once per connection (not re-attached on every
  // state change) -- avoids a stale-closure read of agentuuids/auxcodes.
  const agentuuidsRef = useRef(agentuuids);
  useEffect(() => { agentuuidsRef.current = agentuuids; }, [agentuuids]);
  const auxcodesRef = useRef(auxcodes);
  useEffect(() => { auxcodesRef.current = auxcodes; }, [auxcodes]);

  // Call Profiles -- ported from Flutter's home.dart (initializer, 1441-1450)
  // + dialer.dart (_callProfile, the "Call Profiles" Positioned panel at
  // dialer.dart:5593-5678). Always exactly 5 fixed slots (Available/Away/
  // Busy/Custom 1/Custom 2), never created/deleted -- labels/colors come
  // from the api/index bootstrap's `callprofiles` map, the *active* one from
  // its `profileStatus` index.
  const [activeProfiles, setActiveProfiles] = useState([]); // labels, index-aligned with activeProfileColors
  const [activeProfileColors, setActiveProfileColors] = useState([]); // "#RRGGBB" strings, index-aligned
  // Unknown ('' + neutral grey) until live data says otherwise -- never a
  // guessed "Available" on the header dot before the server has answered.
  // Falls back to Flutter's greenColor2 "Available" default only once
  // /api/index has loaded without a profileStatus (see fetchDashboardData).
  const [activeProfileStatus, setActiveProfileStatus] = useState('');
  const [activeProfileColor, setActiveProfileColor] = useState(PRESENCE_UNKNOWN);
  const [callProfilesLoaded, setCallProfilesLoaded] = useState(false);
  // The bootstrap poll (fetchDashboardData) re-runs every 10s, unlike
  // Flutter's one-shot initialize() -- so profileStatus must only seed
  // activeProfileStatus/activeProfileColor once; afterward they're owned by
  // the user's own selection and the socket 'profile' push (see the
  // presenceMap effect below), same as Flutter never re-deriving them
  // outside initializer().
  const activeProfileSeededRef = useRef(false);
  const [dashboardData, setDashboardData] = useState(null);

  // [chat-keep-open] Chat stays mounted (hidden) once it has been opened, instead of being
  // thrown away on every menu click: going back to it is instant, with the open conversation,
  // scroll position and loaded lists intact, and its live socket updates keep arriving while
  // another page is shown. It is dropped again on sign-out / account switch.
  const chatAccountKey = `${userSession?.subdomain || userSession?.domain || ''}:${userSession?.extension || ''}`;
  const [chatKeptFor, setChatKeptFor] = useState(null);
  useEffect(() => {
    if (activePage === '22' && chatAccountKey !== ':') setChatKeptFor(chatAccountKey);
  }, [activePage, chatAccountKey]);
  const chatKept = chatKeptFor !== null && chatKeptFor === chatAccountKey;
  // [chat-preload] start Chat in the background shortly after sign-in (only for users whose
  // menu has Chat), so the first open is already loaded too. Nothing is stored in the
  // browser: the lists live in memory for this tab only.
  useEffect(() => {
    if (!dashboardData || chatAccountKey === ':') return undefined;
    let hasChat = false;
    try {
      hasChat = getPrimaryMenus().some((m) => m.routePath === '22' || (m.children || []).some((c) => c.routePath === '22'));
    } catch (e) {
      hasChat = false;
    }
    if (!hasChat) return undefined;
    const timer = setTimeout(() => setChatKeptFor((k) => (k === chatAccountKey ? k : chatAccountKey)), 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(dashboardData), chatAccountKey, permissionMode]);
  const [serverResources, setServerResources] = useState(null);
  const [result2, setResult2] = useState(null);
  // Header "update available" banner (home.dart:18598-18732, _loading4/_loading5,
  // updateVersion() at home.dart:3888-3940). `updatingVersion` isn't its own
  // state -- it rides on `session.updatingVersion`, persisted/restored exactly
  // like every other session field (App.jsx's existing localStorage 'session'
  // merge pattern), matching Flutter's `session['updatingVersion']` +
  // login.dart:343-344 restore-on-login.
  const [updateRequesting, setUpdateRequesting] = useState(false);
  const [updateFinalizing, setUpdateFinalizing] = useState(false);
  const [confirmUpdateOpen, setConfirmUpdateOpen] = useState(false);
  // Multi-tenant permission gating (home.dart:1020-1031) -- shared with
  // GlobalSettings.tsx's identical gate via ./utils/licenseGating, so the
  // Main Admin vs Sub Admin distinction (same permissionMode, different
  // sidebar) can't drift between the two call sites.
  const singleInstance = computeSingleInstance(userSession?.subdomain);
  const multiTenantLicenseOwner = computeMultiTenantLicenseOwner(userSession?.subdomain, userSession?.email, result2?.email);

  // Header update-available banner. Gate matches home.dart:18598-18602
  // exactly: (shouldUpdate || finalizing) && singleInstance && permissionMode
  // === 7 && result2.status === 'active'.
  const bannerLatestVersion = String(dashboardData?.latestVersion || '');
  const bannerInput = {
    shouldUpdate: Boolean(dashboardData?.shouldUpdate),
    latestVersion: bannerLatestVersion,
    currentVersion: String(dashboardData?.version || ''),
    updatingVersion: String(userSession?.updatingVersion || ''),
    updatingFromVersion: String(userSession?.updatingFromVersion || ''),
  };
  // "Failed" used to mean only "latest == the version last attempted", which
  // also holds after a successful update whenever the server keeps
  // advertising it. updateBannerState checks the running version instead.
  const bannerState = updateBannerState(bannerInput);
  const bannerUpdateFailed = bannerState === 'failed';
  const bannerUpdateApplied = updateWasApplied(bannerInput);
  const showUpdateBanner =
    (bannerState !== 'hidden' || updateFinalizing) &&
    singleInstance &&
    permissionMode === 7 &&
    result2?.status === 'active';
  const bannerVersionShort = releaseOf(bannerLatestVersion);
  const canUpdateFromBuilds =
    singleInstance &&
    permissionMode === 7 &&
    result2?.status === 'active' &&
    showBuildUpdateButton({
      channel: String(result2?.updateStatus || ''),
      shouldUpdate: bannerInput.shouldUpdate,
      latestVersion: bannerLatestVersion,
      currentVersion: bannerInput.currentVersion,
    });
  // Once an attempt is known to have taken effect, forget it, so a later
  // release is offered as "available" rather than judged against this one.
  useEffect(() => {
    if (!bannerUpdateApplied) return;
    const stored = readStoredSession();
    if (stored) {
      const { updatingVersion: _v, updatingFromVersion: _f, ...rest } = stored;
      localStorage.setItem('session', JSON.stringify(rest));
    }
    setUserSession((prev) => {
      if (!prev) return prev;
      const { updatingVersion: _v, updatingFromVersion: _f, ...rest } = prev;
      return rest;
    });
  }, [bannerUpdateApplied]);

  // After an update the server checks, in the background, whether it can take
  // calls again (ringq_core UpdateReadiness) and rewrites the result after
  // every pass, sent here as dashboardData.updateReady. The admin sees a
  // checklist ticking green until "Ready for calls" (UpdateReadyDialog). The
  // check can still be running after the post-update reload, and the 10 s
  // dashboard poll is what refreshes it.
  const updateReady = useMemo(() => normalizeUpdateReady(dashboardData?.updateReady), [dashboardData?.updateReady]);
  const [updateReadySeen, setUpdateReadySeen] = useState(() => {
    try { return localStorage.getItem('updateReadySeen'); } catch { return null; }
  });
  const updateReadyShown =
    permissionMode === 7 && singleInstance &&
    updateReadyView(updateReady, Date.now(), updateReadySeen) !== 'hidden';
  const closeUpdateReady = () => {
    const key = seenKey(updateReady);
    try { localStorage.setItem('updateReadySeen', key); } catch { /* storage blocked: it shows again next load */ }
    setUpdateReadySeen(key);
  };

  // Update button -- matches Flutter's updateVersion() (home.dart:3888-3940).
  // Explicitly adds a confirmation step Flutter itself doesn't have, per the
  // user's own request: this triggers a real server-side redeploy, so it opens
  // confirmUpdateOpen first (see the confirm dialog further below) rather than
  // calling this straight from the banner's button.
  // The update itself now needs an emailed one-time code (Flutter: runVerifiedUpdate in
  // verified_actions.dart). ActionOtpDialog (rendered below while confirmUpdateOpen) sends the
  // code (GET accounts/security/6?version=), and a correct code posted to accounts/security/3 is
  // what actually starts the update -- so by the time onUpdateVerified runs, the server has
  // already accepted the update; the rest is the same cache-clear + finalizing flow as before.
  const onUpdateVerified = async () => {
    setConfirmUpdateOpen(false);
    setUpdateRequesting(true);
    try {
      if (window.caches) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      }
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      }
    } catch (err) {
      console.error('Failed to clear asset caches:', err);
    }
    setUpdateFinalizing(true);
    // Record what the server runs now, so the next load can tell an update
    // that took effect from one that did not.
    const updateMarker = {
      updatingVersion: bannerLatestVersion,
      updatingFromVersion: String(dashboardData?.version || ''),
    };
    const mergedSession = { ...(readStoredSession() || userSession), ...updateMarker };
    localStorage.setItem('session', JSON.stringify(mergedSession));
    setUserSession((prev) => ({ ...prev, ...updateMarker }));
    setTimeout(() => {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }, 90000);
  };
  const sendUpdateOtpForBanner = useCallback(() => sendUpdateOtp(bannerLatestVersion), [bannerLatestVersion]);
  const handleUpdateDialogClose = useCallback((result) => {
    if (result) onUpdateVerified();
    else {
      setConfirmUpdateOpen(false);
      setUpdateRequesting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerLatestVersion, userSession]);
  // Meet/Dialer specifically: every Admin/Manager (7/8) on the root Main
  // Admin domain, not only the literal license-owner email -- see
  // computeIsMultiTenantRootDomain's own comment (no Flutter equivalent;
  // Flutter's floatingActionButton gate at home.dart:18059 only checks the
  // narrower multiTenantLicenseOwner, an explicit product decision to widen
  // it here). Topbar.tsx applies the same rule to the Meet header button.
  const hideMeetAndDialer = (parseInt(permissionMode) === 7 || parseInt(permissionMode) === 8)
    && computeIsMultiTenantRootDomain(userSession?.subdomain);
  // hideMeetAndDialer removes the only toggle for the dialer panel below --
  // without this, the narrow-viewport default-open (isDialerOpen's own
  // useState initializer) would leave it permanently open and unclosable for
  // exactly the accounts it's meant to be hidden from.
  useEffect(() => {
    if (hideMeetAndDialer) setIsDialerOpen(false);
  }, [hideMeetAndDialer]);
  const [extensions, setExtensions] = useState([]);
  // Own request: gate the sidebar's "Contact Center" item on the LOGGED-IN
  // extension's own "Enable Contact Page" toggle (Edit Extension -> More
  // Options -> showContactModule2), per-agent -- not Flutter's own gate here
  // (an account-wide bootstrap flag, home.dart:1152-1153, never per-extension).
  // A deliberate deviation, requested explicitly. Reads live `extensions`
  // state so it updates on the next 10s fetchDashboardData poll, and
  // instantly for the signed-in user's own edit via handleProfileSessionUpdate above.
  const ownExtensionForMenus = extensions.find(
    (ext) => String(ext.extension) === String(userSession?.extension)
  );
  const enableContactPage = ownExtensionForMenus?.showContactModule2?.toString() === "1";
  const [favorites, setFavorites] = useState([]);
  const [teams, setTeams] = useState([]);
  // Last-seen display data from /api/index (see readDirectoryCache in
  // appHelpers), so a refresh shows real lists/numbers immediately instead of
  // empty pages or placeholders while that large bootstrap loads. Only the
  // read-only views use it (the view* values below), and only until the live
  // data arrives; it's cleared on logout.
  const [cachedDirectory] = useState(() => readDirectoryCache(initialSession));
  // fetchDashboardData doesn't depend on userSession, so read it through a ref
  const userSessionRef = useRef(userSession);
  userSessionRef.current = userSession;
  const [onlineExtensions, setOnlineExtensions] = useState([]);
  const [devicePresence, setDevicePresence] = useState({}); // [device-presence]
  // Device presence feed availability -- matches Flutter's `_deviceFeedAvailable`
  // (extensions.dart:322-325,432-433): true once either the bootstrap already
  // has online extensions, or at least one live 'onlineStatus' push has arrived.
  const [onlineStatusFeedSeen, setOnlineStatusFeedSeen] = useState(false);
  const deviceFeedAvailable = onlineStatusFeedSeen || onlineExtensions.length > 0;
  // Call Status page data -- matches Flutter's home.dart: initial snapshot
  // from the /api/index response (lastActiveCalls/lastFailedCalls), kept
  // live via the 'ringProgress'/'lastActive'/'failedActive' socket events
  // (home.dart:3094-3236).
  const [activeCalls, setActiveCalls] = useState([]);
  // uuid -> time the user confirmed "End call"; see confirmHangup / the ringProgress handler.
  const hungUpUuidsRef = useRef(new Map());
  const [failedCalls, setFailedCalls] = useState([]);
  const [previousCalls, setPreviousCalls] = useState([]);
  // Call Status -> Previous Calls: uuid of the row whose call journey timeline is expanded.
  const [expandedPrevCall, setExpandedPrevCall] = useState(null);
  // Call Status -> Active Calls: live call journeys (queue, who's ringing/talking, timeline),
  // keyed by channel uuid, refreshed every 3s while any call is up. Served by signal.js
  // 'getCallJourneys' from the server's call-journey records.
  const [liveJourneys, setLiveJourneys] = useState({});
  // Team Directory permissions for the logged-in user (/api/index teamCallStatus / teamIncallStatus,
  // set per extension under Extensions -> Team Directory): see others' call status, and their in-call number.
  const [tdPermissions, setTdPermissions] = useState({ callStatus: true, inCallNumber: true });
  const [expandedLiveCall, setExpandedLiveCall] = useState(null);
  useEffect(() => {
    if (!activeCalls.length) {
      setLiveJourneys((prev) => (Object.keys(prev).length ? {} : prev));
      return undefined;
    }
    let cancelled = false;
    const ids = [...new Set(activeCalls.flatMap((r) => [r?.uuid, r?.b_uuid]).filter(Boolean).map(String))];
    const load = async () => {
      try {
        const res = await socketService.emitWithAck('getCallJourneys', ids);
        if (!cancelled && res && typeof res === 'object') setLiveJourneys(res);
      } catch (e) { /* server without call-journey support: leave columns empty */ }
    };
    load();
    const timer = setInterval(load, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [activeCalls]);
  const [callActionConfirm, setCallActionConfirm] = useState(null);


  // Wallboard's Agent Details toggle/Reason/"Logged In" count needs to know
  // which extensions are actually SIP-registered right now. Flutter's own
  // signal for this (`wallStatus`, a 'status' socket event) is unreliable in
  // practice -- confirmed live (MIGRATION_PLAN.md's Wallboard round 3) that
  // over a sustained real session it only ever pings the CALLING client's
  // own extension, never broadcasting other agents' registration changes,
  // so agents whose device actually disconnected kept showing whatever aux
  // code they were last set to ("Available") instead of Offline. The
  // 'onlineStatus' socket event (already wired for Call Status's Online
  // Extensions tab, and confirmed live to reliably list every currently-
  // registered device) is a far more reliable source for the same fact --
  // resolve each entry's `reg_user` (a SIP username) to a friendly
  // extension number via `extensions[].username`, same lookup
  // src/components/connections.tsx already uses for the same field.
  const wallboardRegisteredExtensions = useMemo(() => {
    const set = new Set();
    const byUsername = new Map();
    extensions.forEach(e => { if (e && e.username) byUsername.set(String(e.username), e); });
    // [presence-live] devices also register with the number alias or the plain extension
    extensions.forEach(e => {
      if (!e || !e.extension) return;
      if (e.number_alias && !byUsername.has(String(e.number_alias))) byUsername.set(String(e.number_alias), e);
      if (!byUsername.has(String(e.extension))) byUsername.set(String(e.extension), e);
    });
    onlineExtensions.forEach(row => {
      const username = row?.reg_user;
      if (!username) return;
      const match = byUsername.get(String(username));
      set.add(match ? String(match.extension) : String(username));
    });
    // A mobile app in the background (Android/iOS) drops its SIP registration but still rings
    // via push. signal.js 'devicePresence' lists extensions with an active push token
    // (push: ['android'|'ios']) -- count them as reachable so the Team Directory and the
    // dialer's transfer list don't show "Unregistered" for a phone that rings.
    Object.entries(devicePresence || {}).forEach(([extNo, d]) => {
      if (isPushReachable(d)) set.add(String(extNo)); // disabled extensions never count
    });
    return set;
  }, [onlineExtensions, extensions, devicePresence]);

  // Call Status/Dashboard tables' Caller column -- matches Flutter's
  // outboundIds+domainUsernames2 chain (home.dart:1424-1437, 5872-5892).
  // An outbound call's cid_num often carries the placing device's raw
  // registered SIP URI (the "user" part before '@'), not its extension
  // number, so it has to be resolved: URI -> reg_user (via onlineExtensions)
  // -> extension (via username). An inbound call's cid_num is already the
  // external caller's own number and never matches either map, so this
  // resolves to a no-op for it -- which is why the bug only ever showed up
  // on outbound calls.
  const resolveCallParticipantId = useMemo(() => {
    const byUsername = new Map();
    extensions.forEach(e => { if (e && e.username) byUsername.set(String(e.username), e); });
    const outboundIds = new Map();
    onlineExtensions.forEach(row => {
      const regUser = row?.reg_user;
      if (!regUser || !byUsername.has(String(regUser))) return;
      const key = String(row?.url || '')
        .replace(/\s/g, '')
        .replace(/"/g, '')
        .replace('<sip:', '')
        .split('@')[0];
      if (key) outboundIds.set(key, String(regUser));
    });
    return (rawId) => {
      const raw = String(rawId ?? '');
      const username = outboundIds.get(raw) ?? raw;
      const ext = byUsername.get(username);
      return ext ? String(ext.extension) : username;
    };
  }, [extensions, onlineExtensions]);
  const [gateways, setGateways] = useState([]);
  // Dashboard's System Information "Trunks" row (home.dart:1012, rendered
  // ~14807-14857) reads a THIRD, separate bootstrap field -- not `gateways`
  // (used elsewhere for the Callflow SIP trunk management page) or
  // `gateways2` (unused in any UI Flutter actually renders). Each entry is a
  // single-key map: `{gatewayName: registeredBool}`.
  const [gateways3, setGateways3] = useState([]);
  const [dids, setDids] = useState([]);
  // Dialer keypad's own Active-DID picker (dialer.dart:2983-3042) -- the
  // logged-in extension's own configured outbound caller IDs, same
  // `outbound_dids` concept as ExtensionDetailModal's Configure popup, just
  // pre-resolved for "me" straight off the bootstrap payload
  // (home.dart:1109-1131: `outboundDids`/`outboundCallerID`), not a
  // separate fetch.
  // Seeded from the last-seen /api/index (cachedDirectory) so the dialer's
  // from number shows instantly on refresh; the live response still
  // overwrites it once, below.
  const [outboundDids, setOutboundDids] = useState(() =>
    cachedDirectory?.outboundDids ? ['', ...cachedDirectory.outboundDids] : []);
  const [outboundCallerId, setOutboundCallerId] = useState(() => cachedDirectory?.outboundCallerID || '');
  // Mirror every change (the dialer's pick, or its revert on a failed save)
  // into the cache right away, so a quick refresh never shows the old number.
  useEffect(() => {
    updateDirectoryCacheCallerId(userSessionRef.current, outboundCallerId);
  }, [outboundCallerId]);
  // home.dart's initializer() (and so outboundDids/outboundCallerID) only
  // ever runs once at load -- our fetchDashboardData poll re-runs every 10s
  // (see activeProfileSeededRef above for the same gap), so without this
  // guard the next poll tick silently stomps the user's own dropdown pick
  // right back to whatever the server still thinks is current.
  const outboundDidSeededRef = useRef(false);
  const [ivrs, setIvrs] = useState([]);
  const [queues, setQueues] = useState([]);

  // Team Directory / Intercom on-call state, per extension: who is ringing or talking, with whom,
  // inbound/outbound and which queue. Built from the live active-calls feed ('ringProgress')
  // plus the call journeys. WebRTC/app users appear in that feed under their SIP username
  // (number_alias), not their extension, so both are resolved -- before this, their card never blinked.
  const onCallInfo = useMemo(() => {
    const extSet = new Set(extensions.map((e) => e && String(e.extension)).filter(Boolean));
    const alias = new Map();
    extensions.forEach((e) => {
      if (!e || !e.extension) return;
      if (e.username) alias.set(String(e.username), String(e.extension));
      if (e.number_alias) alias.set(String(e.number_alias), String(e.extension));
    });
    const toExt = (v) => {
      const raw = String(v ?? '').split('@')[0].trim();
      if (!raw) return '';
      return extSet.has(raw) ? raw : (alias.get(raw) || '');
    };
    const queueFrom = (row, jr) => {
      let qext = String(jr?.queue_ext || '');
      if (!qext) {
        for (const v of [row.cid_name, row.b_cid_name, row.callee_name, row.b_callee_name]) {
          const m = String(v || '').match(/\(\s*(9\d{3})\s*\)/);
          if (m) { qext = m[1]; break; }
        }
      }
      if (!qext) return '';
      const qname = String(jr?.queue_name || queues.find((q) => String(q.queue_extension) === qext)?.queue_name || '').trim();
      return qname ? `${qname} (${qext})` : `Queue ${qext}`;
    };
    const cleanName = (v) => String(v || '').replace(/\(\s*\d+\s*\)/g, '').trim();
    const map = new Map();
    const put = (ext, info) => {
      if (!ext) return;
      const prev = map.get(ext);
      // a talking leg wins over a ringing one for the same person
      if (!prev || (prev.state === 'ringing' && info.state === 'talking')) map.set(ext, info);
    };
    activeCalls.forEach((row) => {
      if (!row) return;
      const jr = liveJourneys[String(row.uuid)] || liveJourneys[String(row.b_uuid)] || null;
      // queue calls: agents being rung don't appear in the call feed until one answers,
      // so take them from the journey ("ringing_now" = rung and not yet failed/answered)
      if (jr && Array.isArray(jr.ringing_now)) {
        const callerNum = String(jr.from || row.cid_num || '');
        jr.ringing_now.forEach((ext) => put(String(ext), {
          state: 'ringing', direction: 'Inbound', number: callerNum, name: '', queue: queueFrom(row, jr), since: 0,
        }));
      }
      const callerExt = toExt(row.cid_num) || toExt(row.presence_id);
      const calleeExt = toExt(row.dest) || toExt(row.b_presence_id);
      const states = `${row.callstate || ''} ${row.b_callstate || ''}`.toUpperCase();
      const state = /ACTIVE|HELD/.test(states) ? 'talking' : 'ringing';
      const since = Number(row.call_created_epoch || row.created_epoch) || 0;
      const queue = queueFrom(row, jr);
      if (callerExt && callerExt !== calleeExt) {
        const peer = calleeExt || String(row.dest ?? '');
        const external = !calleeExt && peer.replace(/\D/g, '').length > 4;
        put(callerExt, { state, direction: external ? 'Outbound' : 'Internal', number: peer, name: '', queue: '', since });
      }
      if (calleeExt) {
        const peer = callerExt || String(row.cid_num ?? '');
        put(calleeExt, {
          state,
          direction: callerExt ? 'Internal' : 'Inbound',
          number: peer,
          name: callerExt ? '' : cleanName(row.cid_name) === peer ? '' : cleanName(row.cid_name),
          queue,
          since,
        });
      }
    });
    return map;
  }, [activeCalls, liveJourneys, extensions, queues]);
  const onCallExtensions = useMemo(() => new Set(onCallInfo.keys()), [onCallInfo]);
  // [presence-live] same inputs the Team Directory uses, for User Roles / Chameleon
  useEffect(() => {
    setLivePresenceInputs(deviceFeedAvailable ? wallboardRegisteredExtensions : undefined, onCallExtensions);
  }, [deviceFeedAvailable, wallboardRegisteredExtensions, onCallExtensions]);
  const [queues2, setQueues2] = useState([]);
  // queues3/queues4 (office-hours / break-hours schedule rows, same [status, day_week,
  // end_minutes, start_minutes, destination] shape as ivrs3/ivrs4) and agents3 (candidate
  // agent/manager list) were already arriving in every api/index response but were only ever
  // read off the raw dashboardData blob -- promoted to named state here so the Queue module
  // doesn't need its own bootstrap fetch (confirmed live field names via a direct api/index
  // fetch, not assumed from the Flutter source alone).
  const [queues3, setQueues3] = useState([]);
  const [queues4, setQueues4] = useState([]);
  // Queue schedule data (per-day office/break hours) is loaded once, like Flutter's own
  // one-shot initialize() -- NOT re-applied on every 10s poll tick like most of this
  // bootstrap. Flutter never re-fetches this after a schedule edit; it just mutates its
  // own in-memory queues3/queues4 lists in the scheduling call's success handler and
  // trusts that for the rest of the session (callflow.dart:1002-1046 etc.). QueueFormPage
  // now does the same (its handlers patch queues3/queues4 directly via setQueues3/
  // setQueues4 after each save) -- so letting the blanket poll clobber it back to
  // whatever api/index last returned would just re-introduce the same "edit disappears
  // within ~10s" symptom this was built to fix.
  const queues3And4LoadedRef = useRef(false);
  const [agents3, setAgents3] = useState([]);
  const [queueDidAssignments, setQueueDidAssignments] = useState([]);
  const [queueConfig, setQueueConfig] = useState([]);
  const [queueManagers, setQueueManagers] = useState([]);
  const [queueManagers2, setQueueManagers2] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [callcenterRinqTalkModes, setCallcenterRinqTalkModes] = useState([]);
  const [timeschedules, setTimeschedules] = useState({});
  const [conferences, setConferences] = useState([]);
  const [faxes, setFaxes] = useState([]);
  const [autoProvisions, setAutoProvisions] = useState({});
  const [timezoneProvisions, setTimezoneProvisions] = useState({});
  // Domain-wide default timezone for Global Settings > Language & Office
  // Hours (home.dart: `timezone = content['timezone'] ?? ''`) -- distinct
  // from timezoneProvisions (per-model auto-provisioning timezone).
  const [timezone, setTimezone] = useState('');
  const [devices, setDevices] = useState([]);
  const [facebookSettings, setFacebookSettings] = useState([]);
  const [whatsappSettings, setWhatsappSettings] = useState([]);
  const [telegramSettings, setTelegramSettings] = useState([]);
  const [lineSettings, setLineSettings] = useState([]);
  const [webChatSettings, setWebChatSettings] = useState([]);
  // SMS provider settings (home.dart:1270-1293 smsTwilioSettings/smsTelnyxSettings ->
  // twilioSettings2/telnyxSettings2) -- the Chats panel's "SMS" channel merges both.
  const [telnyxSettings, setTelnyxSettings] = useState([]);
  const [twilioSettings, setTwilioSettings] = useState([]);
  // Chat channel -> Queue extension assignment maps (home.dart:1164-1177). Keyed by queue
  // extension, value is an array of that channel's account ids assigned to it.
  const [callcenterFacebookChats, setCallcenterFacebookChats] = useState({});
  const [callcenterWhatsappChats, setCallcenterWhatsappChats] = useState({});
  const [callcenterWebChats, setCallcenterWebChats] = useState({});
  const [callcenterLineChats, setCallcenterLineChats] = useState({});
  const [callcenterTelegramChats, setCallcenterTelegramChats] = useState({});
  const [callcenterTelnyxChats, setCallcenterTelnyxChats] = useState({});
  const [callcenterTwilioChats, setCallcenterTwilioChats] = useState({});
  // System Status chart: timestamped {at, cpu, memory, disk} samples, ported
  // from ringq_webapp/lib/widgets/system_status_series.dart. Seeded once from
  // api/index's serverResources history fields, then appended to live from
  // the systemInfo2 socket tick -- see systemStatusSeededRef below.
  const [systemStatusSamples, setSystemStatusSamples] = useState([]);
  const [systemStatusLastUpdated, setSystemStatusLastUpdated] = useState(null);
  const [systemStatusRange, setSystemStatusRange] = useState(SYSTEM_STATUS_DEFAULT_RANGE);
  const [systemStatusClockTick, setSystemStatusClockTick] = useState(0);
  const [systemStatusPlotWidth, setSystemStatusPlotWidth] = useState(650);
  const systemStatusSeededRef = useRef(false);

  // Realtime Socket.IO Connection (Ported from Flutter home.dart) -- shared
  // transport for both dashboard "systemInfo" stats AND call orchestration
  // (attended transfer, conference, call parking) via socketService.
  useEffect(() => {
    if (!isAuthenticated || !dashboardData || !dashboardData.walltoken) {
      socketService.disconnect();
      // A fresh login must reseed the System Status history rather than
      // resume appending onto a previous session's samples.
      systemStatusSeededRef.current = false;
      setSystemStatusSamples([]);
      setSystemStatusLastUpdated(null);
      return;
    }

    const host = getApiHost();

    const socket = socketService.connect({
      host,
      token: dashboardData.walltoken,
      channel: userSession.subdomain || userSession.domain || host,
      extension: userSession.extension || '1000',
      agentuuid: dashboardData.agentuuid || '',
      pushToken: '',
      deviceId: 'webapp-device-id'
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected to realtime notification socket');
      // Emit systemInfo immediately upon connect
      socket.emit('systemInfo');
      // Re-attach call-orchestration listeners on every (re)connect.
      sipService.bindSocketListeners();

      // Agent identity registration -- ported from Flutter's home.dart
      // _loadData() 'communicate' emits (type 3/7/updatetoken/14), which this
      // socket connection never sent before. The backend uses this to map
      // the socket back to an extension/role; without it, features that call
      // BACK to this session (e.g. the Manager panel's Take Over/Coaching/
      // Observe, which needs the backend to originate a monitor call to
      // *this* extension) have no session to target and silently no-op.
      const agentKey = `${userSession.extension}-Agent-${userSession.username}-${userSession.email}-${host}`;
      socket.emit('communicate', {
        id: String(userSession.extension || ''),
        type: 3,
        email: String(userSession.email || ''),
        username: String(userSession.username || ''),
        Dept: 'Agent',
        role: 'Agent',
        user_type: 'Agent',
        Agent_Name: `${userSession.firstname || ''} ${userSession.lastname || ''}`.trim(),
        agent_extension: String(userSession.extension || ''),
        url: host
      });
      socket.emit('communicate', {
        type: 7,
        roomtype: 'all',
        roomstatus: '0',
        username: String(userSession.username || ''),
        email: String(userSession.email || ''),
        agent_key: agentKey
      });
      socket.emit('communicate', {
        type: 'updatetoken',
        token: '',
        key: `${userSession.extension}@@@${host}`
      });
      socket.emit('communicate', { type: '14' });
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from socket');
    });

    socket.on('systemInfo2', (value) => {
      console.log('[Socket] Received systemInfo2 realtime update:', value);
      if (value) {
        setServerResources(prev => {
          // Merge with previous to preserve fields like systemIpAdress, sytemOwnerParner, etc.
          const merged = { ...prev, ...value };

          // Append one live System Status sample from the merged snapshot
          // (ported from SystemStatusSeries.appendLive).
          const tickAt = Date.now();
          setSystemStatusSamples(prevSamples => systemStatusAppendLive(prevSamples, merged, tickAt));
          setSystemStatusLastUpdated(tickAt);

          return merged;
        });
      }
    });

    // Live aux-code/queue-login sync (matches Flutter's home.dart:2451-2467
    // 'status' handler) -- lets a queue-login/logout made elsewhere (another
    // device, or a supervisor-forced change) reflect here too.
    socket.on('status', (value) => {
      // Global live status broadcast covering every agent/queue in the
      // system, not just this one -- matches Flutter's unconditional
      // wallAuxcodes.addAll({value['agent']: value['auxcode']}). Keeps each
      // per-queue row in the Aux Codes panel live without re-polling.
      if (value && value.agent && value.auxcode !== undefined) {
        setWallAuxStatuses(prev => ({ ...prev, [value.agent]: value.auxcode }));
      }
      // Same 'status' event also carries SIP-registration pings, keyed by
      // extension rather than agent uuid (home.dart:2828-2830) -- only when
      // there's no 'device' field (that's a different, push-token-only
      // variant of this event Flutter branches away from at the same spot).
      if (value && value.extension !== undefined && !value.device) {
        setWallStatus(prev => ({ ...prev, [value.extension]: value.status }));
      }
      if (value && value.queue_extension !== undefined && value.agent && agentuuidsRef.current.includes(value.agent)) {
        if (value.queue_extension.toString() === '0') {
          if (value.auxcode === 'Available') {
            setQueueLogIn(true);
            const availableCode = auxcodesRef.current[0];
            if (availableCode) setAuxcodeStatus(availableCode.auxcode_uuid);
          } else {
            setQueueLogIn(false);
          }
        }
      }
    });

    // Call Status page live feeds -- matches Flutter's home.dart:3094-3236.
    const parseSocketPayload = (value) => {
      if (typeof value === 'string') {
        try { return JSON.parse(value); } catch { return null; }
      }
      return value;
    };

    // Each event's payload is `{row_count, rows}` -- when row_count is 0,
    // `rows` is omitted entirely rather than sent as `[]`. Always replace
    // wholesale (parseCallRowsArray defaults missing/non-array `rows` to
    // `[]`) so a call ending clears it from the list instead of leaving a
    // stale entry from the last non-empty update.
    socket.on('ringProgress', (value) => {
      const parsed = parseSocketPayload(value);
      // Calls the user just ended stay hidden for 15s -- a push already in flight when they
      // confirmed would otherwise bring the row back until the next update.
      const now = Date.now();
      const hungUp = hungUpUuidsRef.current;
      hungUp.forEach((at, id) => { if (now - at > 15000) hungUp.delete(id); });
      setActiveCalls(parseCallRowsArray(parsed?.rows).filter((r) => !hungUp.has(String(r?.uuid))));
    });

    socket.on('lastActive', (value) => {
      const parsed = parseSocketPayload(value);
      setPreviousCalls(parseCallRowsArray(parsed?.rows));
    });

    socket.on('failedActive', (value) => {
      const parsed = parseSocketPayload(value);
      setFailedCalls(parseCallRowsArray(parsed?.rows));
    });

    // [device-presence] connected device kinds per extension, for Team Directory icons
    // [ext-access] Enable / Mobile App / Webapp / Call Control changed for this extension
    socket.on('accessChanged', (value) => {
      const v = parseSocketPayload(value) || value;
      if (!v || typeof v !== 'object') return;
      if (v.enabled === false) { forceSignOutRef.current?.('Your extension has been disabled. Please contact your administrator.'); return; }
      if (v.webapp === false) { forceSignOutRef.current?.('Web app access has been turned off for your extension. Please contact your administrator.'); return; }
      if (typeof v.app === 'boolean') setAppEnabled(v.app);
      if (typeof v.callcontrol === 'boolean') setCallcontrolEnabled(v.callcontrol);
    });

    socket.on('devicePresence', (value) => {
      const parsed = parseSocketPayload(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) { setDevicePresence(parsed); setDevicePresenceStore(parsed); }
    });

    socket.on('onlineStatus', (value) => {
      const parsed = parseSocketPayload(value);
      if (Array.isArray(parsed)) setOnlineExtensions(parsed);
      // Matches Flutter's `_deviceFeedAvailable = true` set unconditionally
      // inside _handleOnlineStatus (extensions.dart:423-434) -- any push at
      // all, even an empty one, means the live feed is genuinely connected.
      setOnlineStatusFeedSeen(true);
    });

    // Also periodic emission of systemInfo every 10 seconds (matching Flutter's tick % 10 == 0)
    const interval = setInterval(() => {
      if (socket.connected) {
        socket.emit('systemInfo');
      }
      // Re-render the System Status header on the same cadence so the
      // Live/stale badge notices a dead socket even when no new sample
      // arrives to trigger a render by itself.
      setSystemStatusClockTick(tick => tick + 1);
    }, 10000);

    return () => {
      clearInterval(interval);
      socketService.disconnect();
    };
    // Depend on dashboardData's PRESENCE (Boolean(dashboardData): false ->
    // true exactly once), not its walltoken/agentuuid fields -- confirmed
    // against the Flutter reference (home.dart): `io.io(...)` is called
    // exactly once, at initial login, even though `session['walltoken']` is
    // overwritten on every single api/index poll afterwards (home.dart:1098)
    // -- the backend never expects this socket to re-authenticate just
    // because a later poll happened to mint a fresh token. Depending on the
    // token's VALUE (as this used to) re-ran this whole effect on every ~10s
    // poll that happened to return a different token, tearing down and
    // recreating the connection each time; confirmed live that the backend
    // does this often enough that the connection frequently never finished
    // one handshake before the next poll tore it down again, leaving
    // `socketService.connected` false for extended stretches -- silently
    // breaking anything that needs an ack over it (e.g. MyProfilePage's
    // avatar upload, which surfaced this as "Sorry, unable to upload
    // image." instead of ever showing its loader).
  }, [isAuthenticated, Boolean(dashboardData), userSession.subdomain, userSession.domain, userSession.extension]);

  // Live parked-call slot occupancy (5 orbit slots), shared across idle and
  // in-call UI -- lives in socketService since it must work with no active call.
  const [parkedSlots, setParkedSlots] = useState(['', '', '', '', '']);
  // Live per-extension presence (socketService's 'profile' event), used to
  // show real availability dots on the Conference/Transfer contact pickers
  // below instead of the old hardcoded mock statuses.
  const [presenceMap, setPresenceMap] = useState({});
  // Live missed-call count (socketService's 'missedCall2' event, seeded from
  // api/index's missedCalls) -- drives the History nav icon's badge.
  const [missedCallsCount, setMissedCallsCount] = useState(0);
  // Live wallboard totals (socketService's 'wallboard'/'queueConfigBoard'
  // events) -- drives the dialer's Call Center tiles (waiting_wallboard/
  // answered_wallboard/abandoned_wallboard/total_wallboard), matching
  // Flutter's dialer.dart:5207/5264/5333 reads of the same `walldata` map.
  const [walldata, setWalldata] = useState({});
  // Which Chameleon room the logged-in user's own extension is in right now
  // (1=Cloud PBX/default .. 6=Custom Dialer) -- matches Flutter's global
  // `chameleonMode`, kept live in socketService via the 'chameleon-receiver'
  // socket event and seeded from the bootstrap below.
  const [chameleonMode, setChameleonMode] = useState(1);

  // Tracks the last permissionMode value we've actually applied, across BOTH
  // sources that can deliver one (the 'chameleon-receiver' socket event below,
  // and fetchDashboardData's 10s api/index poll) -- undefined means "haven't
  // applied one yet this session", which must NOT trigger a reload/evacuate
  // (every fresh login's very first read would otherwise force-reload Owner
  // accounts in a loop). Only a genuine change from a previously-applied
  // value counts as a live role change.
  const permissionModeRef = useRef(undefined);
  const applyLivePermissionModeChange = (newMode) => {
    const prevMode = permissionModeRef.current;
    permissionModeRef.current = newMode;
    setPermissionMode(newMode);
    if (prevMode === undefined || prevMode === newMode) return;
    // Live role reassignment (Accounts -> User Roles dragging this same
    // extension into Owner/Manager/Custom/Users) -- matches home.dart:
    // 3622-3627. Becoming Owner reloads the page (that role unlocks
    // menus/bootstrap data a live patch can't safely backfill); every
    // other role just applies immediately, no reload.
    if (newMode === 7) {
      window.location.reload();
      return;
    }
    // Flutter itself doesn't do this (it leaves whatever page was open
    // as-is), but a demoted-mid-session user left sitting on a page their
    // new role can no longer reach (e.g. Call Flow) is a real gap, not a
    // parity item worth preserving -- evacuate to Dashboard when the
    // current page isn't in the new role's own menu set.
    const homeRoute = newMode === 10 ? '24' : '0'; // [user-role] Users have no Dashboard
    const allowedRoutes = new Set([homeRoute, '16']); // home + own Profile, always reachable
    [...getPrimaryMenus(newMode), ...getSecondaryMenus(newMode)].forEach((menu) => {
      allowedRoutes.add(menu.routePath);
      (menu.children || []).forEach((child) => allowedRoutes.add(child.routePath));
    });
    setActivePage((prevPage) => {
      const basePage = String(prevPage).split('-')[0];
      return allowedRoutes.has(basePage) ? prevPage : homeRoute;
    });
  };

  useEffect(() => {
    const unsubscribe = socketService.subscribe(({ parkedSlots, presenceMap, missedCalls, walldata, chameleonMode, queueWallboardCalls, permissionMode: livePermissionMode }) => {
      setParkedSlots(parkedSlots);
      setPresenceMap(presenceMap);
      setMissedCallsCount(missedCalls);
      setWalldata(walldata);
      setChameleonMode(chameleonMode);
      if (livePermissionMode != null) {
        applyLivePermissionModeChange(livePermissionMode);
      }
      // Kept in a ref (not state -- this can tick multiple times a second) so
      // resolveQueueExtensionForNumber always reads the latest live wallboard snapshot; re-attempt
      // any Queue Call Landing trigger that was waiting on this data to arrive.
      queueWallboardCallsRef.current = queueWallboardCalls;
      attemptPendingQueueLanding();
    });
    return unsubscribe;
  }, [attemptPendingQueueLanding]);
  // Call Flow View 2 live chips (callflow2/live/liveStatus.ts) -- only feeds this app already has.
  const callFlowLive = useMemo(() => ({
    presenceMap, onCallExtensions, registeredExtensions: wallboardRegisteredExtensions,
    wallAuxStatuses, wallStatus, queues2,
  }), [presenceMap, onCallExtensions, wallboardRegisteredExtensions, wallAuxStatuses, wallStatus, queues2]);
  // Call Center Settings' three hide-toggles (Chameleon page's gear icon) --
  // lifted up here (not local to Chameleon.tsx) because Flutter's own
  // `hideCallCenterSwitch` is a single global shared verbatim between
  // usergroup.dart's settings dialog and dialer.dart's live tiles.
  const [hideCallCenterSwitch, setHideCallCenterSwitch] = useState([false, false, false]);

  // Hotel PBX box data (Chameleon page's Hotel PBX Settings + the dialer
  // widget's own Hotel PBX room screen) -- lifted here for the same reason
  // as hideCallCenterSwitch above: Flutter's `hotelParameters` global is
  // shared verbatim between usergroup.dart and dialer.dart.
  const [hotelParameters, setHotelParameters] = useState(DEFAULT_HOTEL_PARAMS);
  const [showDialButton, setShowDialButton] = useState(true);
  // Which banner (slots 8-10) the Hotel PBX room screen's carousel is
  // showing -- dialer.dart's `_currentIndex`/`_pageController` (:2196-2335).

  // Accounts -> Hotel Front Desk menu visibility -- backed by its own
  // hotel/frontDeskMenu endpoint, independent of the bootstrap api/index
  // payload (hotel_front_desk.dart's fetchHotelFrontDeskMenuEnabled, called
  // once at startup by home.dart:933). Also toggled from Chameleon's Hotel
  // PBX Setting dialog (usergroup.dart:2099-2125), so it's lifted here.
  const [hotelFrontDeskMenuEnabled, setHotelFrontDeskMenuEnabled] = useState(false);
  useEffect(() => {
    fetchHotelFrontDeskMenuEnabled().then(setHotelFrontDeskMenuEnabled).catch(() => { });
  }, []);

  // Voicemail/Reports "Transcribe" column gating -- api/index's own bootstrap
  // `showAITranscribeToken` field is unreliable (confirmed live on a real account: it returned
  // "1" while the account's actual accounts/ai `transcribeTokenEnabled` was empty/off) -- it does
  // not track the Settings -> Global -> AI Transcribe "Enable Transcription" toggle. Always
  // re-derive the real value directly from accounts/ai instead (the same two fields
  // AITranscribeModal.tsx itself reads/writes), matching gsetting.dart's own re-derivation of
  // this exact flag from the same fields, and override whatever api/index said. Called from
  // fetchDashboardData's own success handler (every poll, same cadence as permissionMode/
  // chameleonMode just below) rather than as an independent effect -- an independent effect
  // racing api/index's own first load could resolve first and then get silently clobbered the
  // instant fetchDashboardData's plain `setDashboardData(data)` replace landed after it.
  const refreshAITranscribeGate = useCallback(async () => {
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/accounts/ai`, { credentials: 'include', headers: { Accept: '*/*' } });
      const data = await res.json();
      const content = data?.content || data;
      const enabled = String(content?.transcription_enabled) === 'true' || String(content?.transcribeTokenEnabled) === '1';
      setDashboardData((prev) => (prev ? { ...prev, showAITranscribeToken: enabled } : prev));
    } catch (e) {
      console.warn('[App] Failed to refresh AI Transcribe gate:', e);
    }
  }, []);

  // Queue Call Landing runtime (Settings -> Call Flow -> Edit Queue -> Settings tab's
  // Wrap-up/Queue Call Landing controls actually taking effect on a live queue call) --
  // mirrors home.dart's _checkContact/_postContacts (home.dart:22727-22991). Populated by
  // runQueueCallLanding() below on ring and/or answer for a call resolved to a queue via the
  // live wallboard feed (see resolveQueueExtensionForNumber).
  const [queueCallLandingInfo, setQueueCallLandingInfo] = useState(null);
  const [showQueueCallLandingModal, setShowQueueCallLandingModal] = useState(false);

  // A queue's "hide contact number" setting (QueueFormPage.tsx's Settings tab,
  // settings2.showQueueContact) previously only masked the number inside the Queue Call Landing
  // popup itself -- the dialer widget's own incoming/active call screen still showed it in the
  // clear underneath. Matched by caller number (digits-only) rather than trusting call state
  // alone, since queueCallLandingInfo now deliberately outlives the call it belongs to (see the
  // IDLE/ENDED/FAILED handler above) and must not keep masking a *different*, later call that
  // simply hasn't resolved a queue yet.
  const queueCallLandingMatchesCurrentCall = !!(
    queueCallLandingInfo?.callerNumber &&
    sipCallInfo.remoteNumber &&
    queueCallLandingInfo.callerNumber.replace(/\D/g, '') === sipCallInfo.remoteNumber.replace(/\D/g, '')
  );
  const isCurrentCallNumberHidden = !!(queueCallLandingInfo?.hideContactNumber && queueCallLandingMatchesCurrentCall);

  // Dialer side-rail "Script" tab -- own request: only while the call is actually incoming/
  // ongoing/in-progress (not idle, not after it's ended -- queueCallLandingInfo itself
  // deliberately outlives the call for Wrap-up, so call-state is what actually gates this, not
  // queueCallLandingInfo's own presence), AND only for the specific queue THIS call resolved to,
  // when THAT queue's own Queue Script toggle (Queue Edit -> Script tab) is on. A call from a
  // queue that doesn't have it enabled must not show the tab at all, matching QueueCallLandingModal's
  // own "Queue Script" tab gating (info.showQueueScript) -- same source of truth, same content.
  const LIVE_CALL_STATES = ['RINGING', 'ANSWERING', 'DIALING', 'ACTIVE', 'HOLD'];
  const isCurrentCallQueueScriptEnabled = !!(
    LIVE_CALL_STATES.includes(sipCallInfo.state) &&
    queueCallLandingInfo?.showQueueScript &&
    queueCallLandingMatchesCurrentCall
  );
  // If the Script tab disappears (call ended, or moved on to a queue without it enabled) while
  // it was the one showing, don't leave the side panel stuck open on a tab that's no longer
  // there -- collapse it, same as clicking the tab away.

  // Dialer side-rail "Busy Lamp Field" panel -- was a hardcoded two-row placeholder
  // ("Extension 1001 (Rashid)"/"Extension 1002 (Ram)", not wired to anything real). Real source
  // is the logged-in extension's own BLF rows (Edit Extension -> BLF tab, see
  // ExtensionDetailModal.tsx), exposed as parallel top-level bootstrap arrays
  // `dashboardData.blfEntries`/`blfValues` -- confirmed live against the real backend (saving a
  // BLF row pointing at extension 1015 came back as `blfEntries:["BLF"], blfValues:["1015"]` on
  // the next api/index fetch, a bare identifier, not a formatted "num - name" string) -- matches
  // home.dart's own `_blfEntry` (:6558), reproduced here from that same source.
  const blfEntries = dashboardData?.blfEntries || [];
  const blfValues = dashboardData?.blfValues || [];


  // { color: string|null, blinking: boolean } per row -- null color renders an empty "Blank" cell.

  // Tap behavior per type, matching home.dart's _blfEntry onTap (:6630-6686).

  // dialer.dart's `dialPad2` -- while in a non-default Chameleon room, lets
  // the user flip to the plain numeric keypad via the green phone FAB.
  // Reset to false on every room-mode change, matching the socket handler's
  // explicit `dialPad2 = false` (home.dart:3611-3620).
  useEffect(() => {
    const raw = dashboardData?.hotelParameters;
    if (!Array.isArray(raw) || raw.length === 0) return;
    setHotelParameters((prev) => {
      const next = { ...prev };
      raw.forEach((entry) => {
        const key = Object.keys(entry)[0];
        const slot = Number(key);
        if (!key || Number.isNaN(slot) || slot === 11) return;
        next[slot] = entry[key];
      });
      return next;
    });
    const dialEntry = raw.find((entry) => Object.keys(entry)[0] === '11');
    if (dialEntry && typeof dialEntry['11'] === 'boolean') {
      setShowDialButton(dialEntry['11']);
    }
  }, [dashboardData]);

  // Custom Dialer (chameleonMode === 6) -- has no Flutter equivalent at all
  // (its own UI is dead/commented-out code, per the Chameleon-page pass:
  // `dropContainer('Custom', ...)` is never called). Wholly new feature per
  // explicit request: pick and choose which normal-dialer components show
  // for extensions assigned here. No backend field exists for this (nothing
  // to port), so it's persisted client-side only.
  const DEFAULT_CUSTOM_DIALER_SETTINGS = {
    showCallHistory: true,
    showVoicemail: true,
    showContacts: true,
    showSettingsTab: true,
    showManagerMode: true,
    showAuxSwitch: true,
    showCallProfiles: true,
    // In-call screen controls -- End Call/Accept are deliberately never
    // toggleable here (same reasoning as the keypad tab above: a call
    // screen with no way to hang up or answer isn't a smaller dialer, it's
    // a broken one).
    showSpeaker: true,
    showMute: true,
    showVideoCall: true,
    showRecord: true,
    showHold: true,
    showSurvey: true,
    showTransfer: true,
    showDtmf: true,
    showConference: true,
  };
  const [customDialerSettings, setCustomDialerSettings] = useState(() => {
    try {
      const raw = localStorage.getItem('customDialerSettings');
      return raw ? { ...DEFAULT_CUSTOM_DIALER_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_CUSTOM_DIALER_SETTINGS };
    } catch {
      return { ...DEFAULT_CUSTOM_DIALER_SETTINGS };
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('customDialerSettings', JSON.stringify(customDialerSettings));
    } catch {
      // Storage unavailable (private browsing, quota, etc.) -- setting just
      // won't persist across reloads, not worth surfacing to the user.
    }
  }, [customDialerSettings]);
  // If the currently-open tab is one Custom Dialer just hid, fall back to
  // the keypad tab -- that one's never toggleable (it's the one thing a
  // dialer can't function without).

  // Manager wallboard (Settings -> Callflow -> Queue -> Notification manager
  // assignment surfaced on the Dialer) -- mirrors Flutter's home.dart exactly:
  // `supervisor` is a single account-wide permission flag (content['supervisor'],
  // home.dart:1452), NOT derived from queueManagers. The Manager panel itself
  // shows every queue's live calls unfiltered by queueManagers (home.dart:22423-
  // 22441 reads `queueWallboardCalls`/`abadonedCalls` directly, no per-queue
  // filter) -- queueManagers only exists for the Notification tab's own
  // assignment UI (QueueFormPage.tsx). `_isUserManagerForQueue`/
  // `_hasAutomaticManagerQueueCall` exist in home.dart but are never actually
  // called anywhere (dead code) -- not ported here for the same reason.
  const [supervisor, setSupervisor] = useState(false);
  // {agent_uuid: "Display Name (ext)"} objects -- resolves a queue call's
  // serving_agent uuid to a name, matches Flutter's queueAgentNames2 map
  // (home.dart:1626-1629, built from the same agents5 bootstrap field).
  const [agents5, setAgents5] = useState([]);
  const [queueWallboardCalls, setQueueWallboardCalls] = useState([]);
  // Mirrors Flutter's assets.dart `List abadonedCalls = []` -- emitting
  // 'abandonedQueue' (home.dart:22364) never actually gets a listener that
  // populates this list anywhere in the Flutter source, so this stays empty
  // here too rather than inventing a fetch Flutter itself doesn't have.

  // Take Over / Coaching / Observe -- mirrors home.dart:5810-5914 exactly:
  // supervisorMode is a single global mode (1/2/3), not per-row, and each
  // button only enables when this extension has no active call of its own
  // (Flutter's `if (callParam == null)`, matched here by sipCallInfo.state).
  const [supervisorMode, setSupervisorMode] = useState(0);
  const [supervisorCall, setSupervisorCall] = useState('');
  const triggerSupervisorAction = (mode, eventName, agentName) => {
    if (sipCallInfo.state !== 'IDLE') return;
    const ext = String(agentName).split('(').pop().replace(')', '');
    setSupervisorMode(mode);
    setSupervisorCall(ext);
    socketService.emit(eventName, ext);
  };
  // Backend push that ends the monitor call once the Take Over/Coaching/
  // Observe session is over -- mirrors home.dart:3043-3062 exactly (never
  // ported before: grepping the old codebase for 'supervisor4' had zero
  // hits). Without this, supervisorMode/supervisorCall were only ever SET by
  // triggerSupervisorAction above and never cleared, so a second click
  // after a completed monitor session stayed silently blocked by the
  // `sipCallInfo.state !== 'IDLE'` guard above -- looking exactly like the
  // buttons "don't work".
  useEffect(() => {
    const handleSupervisor4 = (value) => {
      if (!supervisor) return;
      try {
        const content = typeof value === 'string' ? JSON.parse(value) : value;
        if (content && supervisorCall === content.agentExtension) {
          sipService.endCall();
          setSupervisorMode(0);
          setSupervisorCall('');
        }
      } catch (err) {
        console.error('[Supervisor] Failed to parse supervisor4 payload:', err);
      }
    };
    socketService.on('supervisor4', handleSupervisor4);
    return () => socketService.off('supervisor4', handleSupervisor4);
  }, [supervisor, supervisorCall]);

  // Live-updating call duration between the 10s dashboard poll refreshes --
  // Flutter re-renders the queue-calls table every second via
  // ValueListenableBuilder<int> secondsElapsed (home.dart:5784-5786) even
  // though queueWallboardCalls itself only changes when new data arrives.

  // Ringing-call detection matching Flutter's _isQueueWallboardCallRinging
  // (home.dart:504-509).

  // Auto-open the Manager panel on a genuinely NEW ringing queue call while
  // Automatic mode is on -- matches Flutter's _handleQueueCallboardAutoManager
  // (home.dart:535-553) exactly, including that it is unfiltered by queue
  // assignment (gated only by supervisor + managerOpen, same as Flutter's real
  // behavior today).

  // Field-for-field port of Flutter's _queueCallsEntry row renderer
  // (home.dart:5760-5919): queue name/agent name resolved from the same
  // bootstrap lists (queues, agents5) Flutter resolves them from
  // (queueNames/queueAgentNames2), not invented fields.

  // Real extension directory for the in-call Conference "Add" and Transfer
  // contact pickers -- replaces the old hardcoded contactsList mock. Matches
  // Flutter's initiation.dart (`final List _extensionData = extensions;`),
  // the same bootstrap-loaded list used everywhere else in the app, searched
  // by extension/firstname/lastname (initiation.dart:492-518).
  const directoryContacts = extensions
    .filter((ext) => ext && ext.extension)
    .map((ext) => {
      const name = `${ext.firstname || ''} ${ext.lastname || ''}`.trim() || String(ext.extension);
      const presenceStatus = presenceMap[ext.extension]?.status ?? ext.status;
      // `record` carries the raw status fields (status/custom/custom2/status2)
      // the dialer's Intercom/BLF room screens resolve real presence from
      // (utils/extensionPresence.ts), alongside the older green/red flag.
      // [presence-live] same resolver and same inputs as Team Directory, so a person's
      // dot reads the same in both places (live registration, live profile, live call).
      const extNo = String(ext.extension);
      const call = tdPermissions.callStatus ? onCallInfo.get(extNo) : undefined;
      const pushReachable = isPushReachable(devicePresence?.[extNo]);
      const mobile = mobileReach(devicePresence?.[extNo]);
      const p = resolveExtensionPresence(ext, presenceMap[ext.extension], Boolean(call),
        deviceFeedAvailable ? wallboardRegisteredExtensions.has(extNo) : undefined, pushReachable, mobile);
      const callLabel = call
        ? (call.state === 'ringing' ? 'Ringing' : 'On call') + (tdPermissions.inCallNumber && call.number ? ` · ${call.number}` : '')
        : '';
      const live = { key: call ? (call.state === 'ringing' ? 'ringing' : 'oncall') : p.state, label: callLabel || p.label, color: p.color, blink: p.onCall };
      return { ext: extNo, name, status: presenceStatus === '0' ? 'green' : 'red', record: ext, live, registered: deviceFeedAvailable ? wallboardRegisteredExtensions.has(extNo) : undefined, pushReachable, mobile };
    });

  // domainAvatars (assets.dart:642, populated home.dart:1457-1458 from the
  // same `extensions` bootstrap array's `image` field) -- extension number
  // -> avatar image filename, used to resolve a real profile picture for
  // call log rows/contacts instead of always falling back to initials.

  const sessionRetryRef = useRef(false);
  const fetchDashboardDataRef = useRef(null);
  const fetchDashboardData = useCallback(() => {
    if (!isAuthenticated) return;
    const API_BASE = getApiBaseUrl();
    let httpStatus;
    fetch(`${API_BASE}/api/index`, { credentials: 'include' })
      .then(res => { httpStatus = res.status; return res.json(); })
      .then(data => {
        if (data.result === 'success') {
          sessionRetryRef.current = false;
          setDashboardData(data);
          setHolidayBootstrap(data); // [holiday-list]
          // home.dart:1134 -- the account's current role/permission tier lives on
          // this bootstrap response, not the login response (which doesn't
          // reliably carry it); re-read on every 10s poll too (not just once)
          // so a Chameleon/User Roles reassignment applies live even if this
          // poll notices it before the 'chameleon-receiver' socket event does
          // -- applyLivePermissionModeChange no-ops if it's not an actual
          // change from what's already applied.
          if (data.permissionMode !== undefined) {
            applyLivePermissionModeChange(parseInt(data.permissionMode, 10));
          }
          if (data.chameleonMode !== undefined) {
            socketService.seedChameleonMode(parseInt(data.chameleonMode, 10));
          }
          // Called after setDashboardData(data) above, not in a separate effect -- see
          // refreshAITranscribeGate's own comment for why ordering matters here.
          refreshAITranscribeGate();
          if (data.serverResources) {
            setServerResources(data.serverResources);
            // Seed the System Status history exactly once per session (ported
            // from home.dart's _loadData(), which also seeds only at load,
            // not on every poll) -- later ticks arrive over the socket instead.
            if (!systemStatusSeededRef.current) {
              systemStatusSeededRef.current = true;
              const seedAt = Date.now();
              setSystemStatusSamples(systemStatusRebuildSeries(data.serverResources, seedAt));
              setSystemStatusLastUpdated(seedAt);
            }
          }
          if (data.result2 && data.result2.data) {
            setResult2(data.result2.data);
            // Literal key name, typo and all -- home.dart:1033 reads the same
            // `content['result2']["data"]["balanc1e"]`.
            if (data.result2.data.balanc1e !== undefined) {
              setBalance(data.result2.data.balanc1e);
            }
          }
          if (data.content) {
            setExtensions(data.content);
            writeDirectoryCache(userSessionRef.current, data);
            const myExt = data.content.find(e => String(e.extension) === String(userSessionRef.current?.extension));
            if (myExt && (myExt.firstname !== undefined || myExt.lastname !== undefined)) {
              setUserSession(prev => {
                const newFirst = myExt.firstname !== undefined ? myExt.firstname : prev.firstname;
                const newLast = myExt.lastname !== undefined ? myExt.lastname : prev.lastname;
                if (prev.firstname !== newFirst || prev.lastname !== newLast) {
                  const updated = { ...prev, firstname: newFirst, lastname: newLast };
                  try {
                    const saved = readStoredSession();
                    if (saved) {
                      localStorage.setItem('session', JSON.stringify({ ...saved, firstname: newFirst, lastname: newLast }));
                    }
                  } catch { }
                  return updated;
                }
                return prev;
              });
            }
          }
          if (data.companyLimits) {
            setCompanyLimits(data.companyLimits);
          }
          if (data.permissionMode !== undefined && data.companyLimits) {
            try {
              localStorage.setItem('headerChromeCache', JSON.stringify({
                permissionMode: parseInt(data.permissionMode, 10),
                companyLimits: data.companyLimits,
              }));
            } catch {
              // Best-effort cache; a full/unavailable localStorage just
              // means the next refresh falls back to the optimistic default.
            }
          }
          if (data.gatewayStatus !== undefined) {
            setGatewayStatus(data.gatewayStatus);
          }
          // Flutter's `session["mobileAppEnabled"]`/`webAppEnabled`/
          // `callControlEnabled` (home.dart:5362-5372, gates the profile
          // page's QR Code/Settings buttons) -- wire names are actually
          // appEnabled/webappEnabled/callcontrolEnabled (confirmed live).
          if (data.appEnabled !== undefined) setAppEnabled(data.appEnabled);
          if (data.webappEnabled !== undefined) setWebappEnabled(data.webappEnabled);
          if (data.webappEnabled === false) forceSignOutRef.current?.('Web app access has been turned off for your extension. Please contact your administrator.');
          if (data.callcontrolEnabled !== undefined) setCallcontrolEnabled(data.callcontrolEnabled);
          if (data.gateways) {
            setGateways(data.gateways);
          }
          if (data.gateways3) {
            setGateways3(data.gateways3);
          }
          if (data.dids) {
            setDids(data.dids);
          }
          if (!outboundDidSeededRef.current) {
            if (data.outboundDids) {
              // home.dart:1109-1110 unconditionally inserts a blank entry at
              // the front, client-side -- it's never sent by the backend.
              // Rendered as "None" (a real, selectable "no caller ID" option).
              setOutboundDids(['', ...data.outboundDids]);
            }
            if (data.outboundCallerID !== undefined) {
              setOutboundCallerId(data.outboundCallerID || '');
            }
            outboundDidSeededRef.current = true;
          }
          if (data.parkSlots) {
            socketService.setInitialParkedSlots(data.parkSlots);
          }
          if (data.missedCalls != null) {
            socketService.setInitialMissedCalls(data.missedCalls);
          }
          if (data.favorites) {
            setFavorites(data.favorites);
          }
          if (data.teams) {
            setTeams(data.teams);
          }
          if (data.onlineExtensions) {
            setOnlineExtensions(data.onlineExtensions);
          }
          if (data.lastActiveCalls) {
            setPreviousCalls(parseCallRowsArray(data.lastActiveCalls));
          }
          if (data.teamCallStatus != null || data.teamIncallStatus != null) {
            setTdPermissions({
              callStatus: String(data.teamCallStatus ?? '1') !== '0',
              inCallNumber: String(data.teamIncallStatus ?? '1') !== '0',
            });
          }
          if (data.lastFailedCalls) {
            // Confirmed live: unlike lastActiveCalls, this array's elements
            // are JSON-encoded strings, not objects.
            setFailedCalls(parseCallRowsArray(data.lastFailedCalls));
          }
          if (data.ivrs) {
            setIvrs(data.ivrs);
          }
          if (data.queues) {
            setQueues(data.queues);
          }
          if (data.queues2) {
            setQueues2(data.queues2);
          }
          if (!queues3And4LoadedRef.current) {
            if (data.queues3) setQueues3(data.queues3);
            if (data.queues4) setQueues4(data.queues4);
            queues3And4LoadedRef.current = true;
          }
          if (data.agents3) {
            setAgents3(data.agents3);
          }
          if (data.queueDidAssignments) {
            setQueueDidAssignments(data.queueDidAssignments);
          }
          if (data.agents4) {
            // Each entry is a single-key {agentuuid: queue_extension} object.
            const assignments = {};
            data.agents4.forEach(entry => {
              const [uuid, ext] = Object.entries(entry)[0] || [];
              if (uuid) assignments[uuid] = ext;
            });
            setWallQueueAssignments(prev => ({ ...prev, ...assignments }));
          }
          // agentuuids (drives the Aux Code toggle vs. Call Profiles button
          // in the dialer header) -- home.dart:972 reads this from the exact
          // same api/index bootstrap `content['agentuuid2']`, not from a
          // separate call. fetchAuxcodes() below also returns an
          // agentuuid2, but only ever runs once on mount, so an admin
          // removing this extension's queue membership mid-session never
          // reflected in the UI without a full reload. This poll re-runs
          // every 10s already (unlike Flutter's one-shot initialize()), so
          // sourcing agentuuids from here instead keeps it genuinely live --
          // the header control switches within ~10s of the real change.
          // `if (data.agentuuid2)` (not `data.agentuuid2?.length`) so an
          // empty array -- the "just removed from every queue" case -- still
          // updates state instead of being skipped as falsy.
          if (data.agentuuid2) {
            setAgentuuids(data.agentuuid2);
            setAgentuuidsLoaded(true);
          }
          if (data.wallAuxcodes) {
            // Each entry is a single-key {agentuuidOrExtension: status} object.
            // This is the true per-queue-membership status snapshot -- what
            // makes a fresh load show each queue's real Available/Aux state
            // correctly, same as the production app. This dashboard poll
            // re-runs every 10s, but a per-queue toggle here (or on the
            // production app) doesn't reliably persist server-side -- so an
            // already-known key keeps its current (possibly locally-toggled)
            // value instead of snapping back to the stale poll response every
            // 10 seconds; only brand-new keys get filled in from the poll.
            const statuses = {};
            data.wallAuxcodes.forEach(entry => {
              const [key, status] = Object.entries(entry)[0] || [];
              if (key) statuses[key] = status;
            });
            setWallAuxStatuses(prev => ({ ...statuses, ...prev }));
          }
          if (data.queueConfig) {
            setQueueConfig(data.queueConfig);
          }
          if (data.queueManagers) {
            setQueueManagers(data.queueManagers);
          }
          if (data.queueManagers2) {
            setQueueManagers2(data.queueManagers2);
          }
          if (data.supervisor != null) {
            // Mirrors Flutter's `content['supervisor'].toString() == "true"`
            // (home.dart:1452) -- safe whether the backend sends a real
            // boolean or the string "true"/"false".
            setSupervisor(String(data.supervisor) === 'true');
          }
          if (data.agents5) {
            setAgents5(data.agents5);
          }
          if (data.queueWallboardCallStatus) {
            setQueueWallboardCalls(data.queueWallboardCallStatus);
          }
          // Seeds socketService's live Wallboard state (queueWallboardAgentBoard/
          // ConfigBoard were being fetched here and discarded -- never read into
          // any state, so the Wallboard had no agent/queue data at all, live or
          // otherwise). Kept live afterward by the 'queueCallboard'/
          // 'queueAgentboard2'/'queueConfigBoard' socket listeners registered in
          // socketService.connect().
          socketService.setInitialWallboardData({
            calls: data.queueWallboardCallStatus || [],
            agents: data.queueWallboardAgentBoard || [],
            configs: data.queueWallboardConfigBoard || []
          });
          if (data.scripts) {
            setScripts(data.scripts);
          }
          if (data.callcenterRinqTalkModes) {
            setCallcenterRinqTalkModes(data.callcenterRinqTalkModes);
          }
          if (data.timeschedules) {
            setTimeschedules(data.timeschedules);
          }
          if (data.timezone) {
            setTimezone(data.timezone);
          }
          if (data.conferences) {
            setConferences(data.conferences);
          }
          // `faxes` isn't present on every tenant's bootstrap yet (confirmed live: team.ringq.ai
          // returns it, team.ringq.ai -- this project's usual dev backend -- doesn't) --
          // default to [] rather than leaving it undefined so the Others module never crashes.
          setFaxes(data.faxes || []);
          if (data.autoProvisions) {
            setAutoProvisions(data.autoProvisions);
          }
          if (data.timezoneProvisions) {
            setTimezoneProvisions(data.timezoneProvisions);
          }
          if (data.devices) {
            setDevices(data.devices);
          }
          if (data.facebookSettings) {
            setFacebookSettings(data.facebookSettings);
          }
          if (data.whatsappSettings) {
            setWhatsappSettings(data.whatsappSettings);
          }
          if (data.telegramSettings) {
            setTelegramSettings(data.telegramSettings);
          }
          if (data.lineSettings) {
            setLineSettings(data.lineSettings);
          }
          if (data.webChatSettings) {
            setWebChatSettings(data.webChatSettings);
          }
          if (data.smsTelnyxSettings) {
            setTelnyxSettings(data.smsTelnyxSettings);
          }
          if (data.smsTwilioSettings) {
            setTwilioSettings(data.smsTwilioSettings);
          }
          if (data.callcenterFacebookChats) {
            setCallcenterFacebookChats(data.callcenterFacebookChats);
          }
          if (data.callcenterWhatsappChats) {
            setCallcenterWhatsappChats(data.callcenterWhatsappChats);
          }
          if (data.callcenterWebChats) {
            setCallcenterWebChats(data.callcenterWebChats);
          }
          if (data.callcenterLineChats) {
            setCallcenterLineChats(data.callcenterLineChats);
          }
          if (data.callcenterTelegramChats) {
            setCallcenterTelegramChats(data.callcenterTelegramChats);
          }
          if (data.callcenterTelnyxChats) {
            setCallcenterTelnyxChats(data.callcenterTelnyxChats);
          }
          if (data.callcenterTwilioChats) {
            setCallcenterTwilioChats(data.callcenterTwilioChats);
          }
          // Call Profiles -- matches home.dart:1441-1450 (initializer). The
          // account-level labels/colors always refresh (harmless -- Custom
          // 1/2 renaming is otherwise the "known gap" Flutter itself has:
          // extensions.dart:1019 only ever reassigns activeProfileColors,
          // never activeProfiles, so a renamed label needs a reload there
          // too). The *active* status/color seeds from profileStatus once.
          if (data.callprofiles && data.callprofiles.call_profiles) {
            const labels = data.callprofiles.call_profiles.toString().split(',');
            const colors = data.callprofiles.call_profiles_colors.toString().split(',');
            setActiveProfiles(labels);
            setActiveProfileColors(colors);
            if (!activeProfileSeededRef.current && data.profileStatus !== undefined && data.profileStatus !== null) {
              const idx = parseInt(data.profileStatus, 10);
              if (!Number.isNaN(idx) && labels[idx] && colors[idx]) {
                setActiveProfileStatus(labels[idx]);
                setActiveProfileColor(colors[idx]);
              }
              activeProfileSeededRef.current = true;
            }
          }
          // Live data arrived without any profile status (and no socket
          // 'profile' push beat it) -- use Flutter's default, Available.
          if (!activeProfileSeededRef.current) {
            setActiveProfileStatus((s) => s || 'Available');
            setActiveProfileColor((c) => (c === PRESENCE_UNKNOWN ? PRESENCE_AVAILABLE : c));
          }
          setCallProfilesLoaded(true);
        } else {
          // A stored session that's no longer valid server-side (expired,
          // revoked, etc.) -- home.dart's own api/index handler bounces back
          // to /login the same way (storeSession({}) + navigateReplace)
          // instead of leaving a blank/broken dashboard shell up. Without
          // this, the optimistic isAuthenticated=true set from a leftover
          // localStorage session (App.jsx's mount-time session check) never
          // gets corrected, so the app opens straight to the dashboard
          // instead of asking to log in again.
          // [session-retry] one rejected poll is not proof the login is gone (a request can race a
          // cookie refresh, or the server's remember-me restore needs one more round trip): check
          // again once after 2 s and only sign out if that is rejected too.
          if (!sessionRetryRef.current) {
            sessionRetryRef.current = true;
            console.warn('[RingQ] /api/index rejected the session -- checking once more', { httpStatus, data });
            setTimeout(() => { fetchDashboardDataRef.current?.(); }, 2000);
            return;
          }
          sessionRetryRef.current = false;
          console.warn('[RingQ] /api/index rejected the session -- logging out', { httpStatus, data });
          localStorage.removeItem('session');
          clearDirectoryCache();
          clearChatMessageCaches();
          setUserSession({});
          setIsAuthenticated(false);
        }
      })
      .catch(err => console.error("Error fetching dashboard data:", err));
  }, [isAuthenticated, refreshAITranscribeGate]);

  fetchDashboardDataRef.current = fetchDashboardData;
  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
      // [perf] /api/index is ~0.8 MB per call: every 30 s (live changes arrive over the socket),
      // skipped while the tab is hidden, and refreshed right away when it becomes visible again.
      const interval = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        fetchDashboardData();
      }, 30000);
      const onVisible = () => { if (!document.hidden) fetchDashboardData(); };
      document.addEventListener('visibilitychange', onVisible);
      return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
    }
  }, [isAuthenticated, fetchDashboardData]);

  // Fetch aux codes from API
  const fetchAuxcodes = useCallback(() => {
    if (!isAuthenticated) return;
    const API_BASE = getApiBaseUrl();
    fetch(`${API_BASE}/api/auxcodes`, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        auxcode_type: '6'
      }),
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        // Backend wraps the payload as { result, message, content: {...} },
        // same as every other endpoint in this file (see data.content usage
        // elsewhere) -- this one was reading the top level and always got
        // undefined, so auxcodes/agentuuids never populated and the Aux Code
        // toggle (gated on agentuuids.length > 0) silently never rendered.
        const content = data.content || data;
        if (content.auxcodes) {
          setAuxcodes(content.auxcodes);
          setAuxcodeStatus(content.auxcodeStatus || '');
          setAgentuuid(content.agentuuid || '');
          // agentuuids itself is NOT set here anymore -- this call only runs
          // once on mount, so it can't reflect a queue membership change
          // made mid-session. fetchDashboardData's 10s poll owns it now
          // (see that function's own agentuuid2 handling for why).

          // Match Flutter queueLogIn logic: check if active status is "Available"
          const currentAux = content.auxcodes.find(a => a.auxcode_uuid.toString() === content.auxcodeStatus?.toString());
          if (currentAux && currentAux.auxcode_status.toLowerCase() === 'available') {
            setQueueLogIn(true);
          } else {
            setQueueLogIn(false);
          }
        }
      })
      .catch(err => console.error("Error fetching auxcodes:", err))
      .finally(() => setAgentuuidsLoaded(true));
  }, [isAuthenticated]);

  // Set / change aux code status. Ported from Flutter's _agentStatus()
  // (lib/pages/dialer.dart) which is fire-and-forget: it never parses the
  // POST response, it updates local state immediately. React previously
  // gated the state update behind `res.json()` succeeding -- if the backend's
  // response body for this endpoint isn't strict JSON (plausible, since
  // Flutter never reads it), that parse throws, the update silently never
  // happens, and the toggle/dropdown appears to do nothing. Match Flutter:
  // update state optimistically, only log a real error for a failed request.
  const handleUpdateAuxcodeStatus = useCallback((codeUuid, codeStatus) => {
    if (!isAuthenticated) return;
    const API_BASE = getApiBaseUrl();

    setAuxcodeStatus(codeUuid);
    setQueueLogIn(codeStatus.toLowerCase() === 'available');

    fetch(`${API_BASE}/api/auxcodes`, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        auxcode_type: '3',
        auxcode_uuid: codeUuid,
        auxcode_status: codeStatus,
        queue_extension: '0'
      }),
      credentials: 'include'
    }).catch(err => console.error("Error setting auxcode status:", err));
  }, [isAuthenticated]);

  // Set / change aux code status for one specific queue this agent belongs
  // to (a per-row toggle in the Aux Codes panel). Ported from dialer.dart's
  // per-row _agentStatus(status, uuid, wallqueueAssignments[agentuuids[index]]):
  // sends the same POST but with that queue's real queue_extension instead
  // of '0', and updates only that row's own live status (wallAuxStatuses).
  // Verified against the production app that this per-queue POST is accepted
  // but doesn't reliably persist server-side -- same as here, it's an
  // optimistic local update, not a durable one.
  const handleUpdateAuxcodeStatusForQueue = useCallback((codeUuid, codeStatus, queueExtension, agentUuid) => {
    if (!isAuthenticated) return;
    const API_BASE = getApiBaseUrl();

    const nextStatuses = { ...wallAuxStatuses, [agentUuid]: codeStatus };
    setWallAuxStatuses(nextStatuses);

    fetch(`${API_BASE}/api/auxcodes`, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        auxcode_type: '3',
        auxcode_uuid: codeUuid,
        auxcode_status: codeStatus,
        queue_extension: queueExtension || '0'
      }),
      credentials: 'include'
    }).catch(err => console.error("Error setting per-queue auxcode status:", err));

    // Mirror Flutter: once every queue-membership row agrees (all Available,
    // or none Available), also sync the single global agent status -- the
    // field the header pill / top navbar "Online" status actually reads.
    // A mixed set of rows leaves the global status as it already was.
    const allAvailable = agentuuids.length > 0 && agentuuids.every(u => (nextStatuses[u] || '').toLowerCase() === 'available');
    const noneAvailable = agentuuids.length > 0 && agentuuids.every(u => (nextStatuses[u] || '').toLowerCase() !== 'available');
    if (allAvailable && auxcodes.length > 0) {
      handleUpdateAuxcodeStatus(auxcodes[0].auxcode_uuid, auxcodes[0].auxcode_status);
    } else if (noneAvailable && auxcodes.length > 1) {
      handleUpdateAuxcodeStatus(auxcodes[1].auxcode_uuid, auxcodes[1].auxcode_status);
    }
  }, [isAuthenticated, agentuuids, auxcodes, wallAuxStatuses, handleUpdateAuxcodeStatus]);

  // queue_extension -> queue_name lookup for labeling each row in the Aux
  // Codes panel (e.g. "dede (9000)"), sourced from api/index's `queues`.
  const queueExtToName = useMemo(() => {
    const map = {};
    queues.forEach(q => { map[q.queue_extension] = q.queue_name; });
    return map;
  }, [queues]);

  // Select a Call Profile. Ported from dialer.dart:5646-5656 -- local
  // optimistic update, then socket.emit('changeProfile', <0-based index>)
  // followed by the real HTTP persist POST with a *1-based* index (both
  // exactly as Flutter sends them; not a typo). Flutter's own try/catch
  // around this call cannot actually catch the async POST's failure (it
  // wraps the synchronous call, not the awaited Future), so in practice the
  // reference app is silent on a failed persist too -- we go one step
  // further and surface a small in-panel error message on a real network
  // failure, without rolling back the optimistic selection (same as Flutter
  // never rolling back).

  // Live self-profile updates pushed over the existing 'profile' socket
  // event (already captured into socketService's presenceMap for every
  // extension, self included -- matches Flutter's wallProfileStatus). When
  // it's *our own* extension, mirror home.dart:3242-3277's hardcoded
  // index->label/color mapping for slots 0-2 and the pushed color for
  // Custom 1/2 (slots 3-4 use the pushed color but a hardcoded label there
  // too, same "known gap" as Flutter).
  useEffect(() => {
    const own = presenceMap[userSession.extension];
    if (!own || own.status === undefined || own.status === null) return;
    const status = own.status.toString();
    if (status === '0') { setActiveProfileStatus('Available'); setActiveProfileColor(PRESENCE_AVAILABLE); }
    else if (status === '1') { setActiveProfileStatus('Away'); setActiveProfileColor('#F9A825'); }
    else if (status === '2') { setActiveProfileStatus('Busy'); setActiveProfileColor(PRESENCE_BUSY); }
    else if (status === '3') { setActiveProfileStatus('Custom 1'); if (own.color) setActiveProfileColor(softPresenceColor(own.color)); }
    else if (status === '4') { setActiveProfileStatus('Custom 2'); if (own.color) setActiveProfileColor(softPresenceColor(own.color)); }
    activeProfileSeededRef.current = true;
  }, [presenceMap, userSession.extension]);

  // Fetch aux codes when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchAuxcodes();
    }
  }, [isAuthenticated, fetchAuxcodes]);

  // Dialer dragging states and position



  // Matches the actual CSS-rendered overlay widths (App.css) for each mode --
  // .parked-narrow (495) and .manager-wide (1005) both diverge from the
  // default expanded width (685), so position math must know about them too
  // or a wider panel (Manager) can push the main dial pad off-screen.


  // Automatically update and anchor default position when expanded state,
  // mode (BLF/Script/Parked/Manager -- each a different overlay width), or
  // scale changes. If the dialer was manually dragged, re-clamp instead of
  // resetting it, so switching into the wider Manager panel can't leave the
  // main dial pad stranded off-screen.

  // Keep dialer position clamped within viewport on resize



  // Keypress event listener for DTMF during active calls

  // Support
  const [supportAccordion, setSupportAccordion] = useState('voice');
  const [selectedIssues, setSelectedIssues] = useState({
    voice: "Choppy voice.",
    crash: "Application crash.",
    server: "Don't show online."
  });
  const [reportDate, setReportDate] = useState(() => new Date());
  const [reportTime, setReportTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });


  // Active-DID dropdown open/close (the keypad's own picker -- see
  // handleSelectOutboundDid above). The "Dial/All/Favorites" dropdown a
  // previous pass put on this same keypad screen was never real: Flutter's
  // actual `_dropdownList = ["All", "Favorites"]` (dialer.dart:104,129)
  // lives only on the wallboard screen (dialerSubView==='wallboard'),
  // gated behind its own nested "show all" flag -- removed from here
  // entirely, along with the horizontal avatar strip that only ever
  // existed to back it (contactsAvatarsList/filteredAvatars).
  // Wallboard extensions grid is collapsed until a filter (All/Favorites) is
  // picked from its dropdown.

  // Tickets States
  const [isViewingTickets, setIsViewingTickets] = useState(false);
  const [ticketsTab, setTicketsTab] = useState('unread'); // 'unread', 'open', 'closed'
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  // Real tickets from the help desk, through the RingQ backend's
  // accounts/support endpoint -- the same path the Flutter app uses.
  const supportTickets = useSupportTickets(
    [userSession.firstname, userSession.lastname].filter(Boolean).join(' ') || 'You'
  );



  // Chart Tooltip Hover State
  const [hoveredData, setHoveredData] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const chartRef = useRef(null);
  const chartTooltipRef = useRef(null);
  // Sliding pill behind the active time range (styles/tabMotion.css).
  const statusRangeRef = useTabIndicator([systemStatusRange]);

  // Axis density is sized from the chart's own measured box, never from the
  // viewport -- this card is routinely a third of the window wide, and
  // sizing the axis to the screen is how it ends up crowded in every layout
  // but the one it was eyeballed in (system_status_chart.dart's LayoutBuilder).
  useEffect(() => {
    const el = chartRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSystemStatusPlotWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [activePage]);

  // Dashboard view: '1' = the table-first live calls view (the default),
  // '2' = the overview (status chart, extensions dial, system information).
  // The user's pick is saved as their default (services/dashboardView.ts;
  // browser-only until the backend endpoint in BACKEND_REQUESTS.md exists).
  const dashboardAccountKey = userSession.username || userSession.email || 'default';
  const [dashboardView, setDashboardView] = useState(() => peekDashboardView(dashboardAccountKey));
  useEffect(() => {
    let alive = true;
    setDashboardView(peekDashboardView(dashboardAccountKey));
    loadDashboardView(dashboardAccountKey)
      .then((view) => { if (alive) setDashboardView(view); })
      .catch(() => { /* keep the last-known view */ });
    return () => { alive = false; };
  }, [dashboardAccountKey]);
  const chooseDashboardView = (view) => {
    if (view !== '1' && view !== '2') return;
    setDashboardView(view);
    // A failed save still applies the view for this session; it just won't
    // be remembered as the default.
    saveDashboardView(dashboardAccountKey, view).catch(() => { });
  };
  const [showDashboardSysInfo, setShowDashboardSysInfo] = useState(false);
  const [showDashboardTrunks, setShowDashboardTrunks] = useState(false);

  // Dashboard copy buttons (license key, FQDN, IP): "Copied" shows next to
  // the button that was clicked for a moment. Falls back to execCommand
  // where the async clipboard API isn't available (non-HTTPS origins).
  const [dashCopied, setDashCopied] = useState(null);
  const dashCopiedTimer = useRef(null);
  useEffect(() => () => clearTimeout(dashCopiedTimer.current), []);
  const copyDashValue = (id, value) => {
    const text = String(value ?? '');
    if (!text) return;
    const done = () => {
      setDashCopied(id);
      clearTimeout(dashCopiedTimer.current);
      dashCopiedTimer.current = setTimeout(() => setDashCopied(null), 1600);
    };
    const fallback = () => {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        if (ok) done();
      } catch {
        // Nothing else to try; the button just doesn't confirm.
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  };

  // Files picked in the support chat aren't sent: accounts/support takes no
  // uploads yet (BACKEND_REQUESTS.md, "Support tickets with attachments").
  const handleSupportSubmit = ({ category, issue, description = '' }) => {
    const reportDateLabel = reportDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const [reportHour, reportMinute] = reportTime.split(':').map(Number);
    const reportTimeLabel = new Date(2000, 0, 1, reportHour, reportMinute).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const mainIssue = issue || selectedIssues[category] || 'Other Support Request';
    return supportTickets.submitTicket({
      category,
      issue: mainIssue,
      description: `Reported issue: ${mainIssue}\nReport date: ${reportDateLabel} at ${reportTimeLabel}${description ? `\n\n${description}` : ''}`,
    });
  };



  // Shared room-screen header (dialer.dart's `headerContent()`) -- reused
  // verbatim by Hotel PBX/Intercom/BLF's room screens (dialer.dart:2199/
  // 2383/2541 all call the exact same function with just a different
  // `value` argument, always "Room {extension}" here).

  // Shared numeric keypad markup -- used both by the normal Dial tab and by
  // the Hotel PBX (and future Intercom/BLF) room screens' own dialPad2
  // toggle (dialer.dart:2202-2203/2386-2387/2544-2545 all reuse the same
  // `dialPad()` widget that way).


  // Physical-keyboard entry for the pre-dial keypad -- dialer.dart:3334-3414
  // keeps one always-focused `keyboardNode` for the whole widget (an outer
  // InkWell.onTap requests it, a Focus.onKeyEvent handles every key) so
  // typing works no matter what was last tapped, without the number field
  // itself ever behaving like a normal focused text box. Reproduced the same
  // "always works" effect via a global listener instead of the input's own
  // focus: when the field truly is focused (the user clicked in to edit
  // mid-string), skip this entirely and let native input behavior handle it
  // -- that's the one case that needs real cursor-position awareness, which
  // this append/trim-at-the-end listener doesn't attempt to replicate.

  // dialer.dart's _initialize2(type, page) -- GET api/history/{type}/{page},
  // type 1 = All, type 2 = Missed. page 1 replaces the list, further pages
  // (pagination/"Load more") append.

  // Refetch "All" fresh every time the History tab is opened -- matches
  // dialer.dart's bottom-nav phone icon handler (resets page/list then
  // refetches), not a one-time-per-session load.

  // "Missed" loads lazily on first switch to that sub-tab (dialer.dart's
  // _initial2 guard), not refetched on every switch back to it.



  // dialer.dart's _initialize3(page) -- GET api/voicemails/{page}/2.



  // Release the previous blob URL whenever a new one is created or the
  // dialer unmounts, so playback never leaks object URLs.

  // dialer.dart's voicemailEntry onTap -- toggles playback for this row;
  // tapping the currently-open row again closes it instead of refetching.
  // POST api/voicemails both marks it read and returns the audio bytes
  // (_postVoicemails), matched here as one fetch that resolves to a blob.




  // System Status chart geometry -- ported from system_status_chart.dart's
  // _plot(). The plot spans the DATA, not the nominal range: `windowed` is
  // already clipped to the selected range, so its own extent is the honest
  // window (the selector means "at most this much"), which is what stops a
  // freshly loaded 24h view from drawing a blank shortfall down one side.
  const systemStatusRangeMs = (
    SYSTEM_STATUS_RANGES.find(r => r.key === systemStatusRange)
    || SYSTEM_STATUS_RANGES.find(r => r.key === SYSTEM_STATUS_DEFAULT_RANGE)
  ).ms;
  const systemStatusWindowed = systemStatusWindow(systemStatusSamples, systemStatusRangeMs);
  const hasSystemStatusData = systemStatusWindowed.length > 0;

  const SYSTEM_STATUS_PLOT_X0 = 20;
  // Ends short of the 720 viewBox so each line's end label has room.
  const SYSTEM_STATUS_PLOT_X1 = 668;

  let systemStatusStepMinutes = 5;
  let systemStatusAxisEpoch = 0;
  let systemStatusMinX = 0;
  let systemStatusMaxX = 1;
  let systemStatusCrossesMidnight = false;
  let systemStatusAxisTicks = [];

  if (hasSystemStatusData) {
    const start = systemStatusWindowed[0].at;
    const end = systemStatusWindowed[systemStatusWindowed.length - 1].at;
    const span = Math.max(end - start, 60 * 1000);
    systemStatusStepMinutes = systemStatusNiceIntervalMinutes(span, systemStatusPlotWidth);

    const dayStart = new Date(start);
    dayStart.setHours(0, 0, 0, 0);
    const offsetMin = Math.floor((start - dayStart.getTime()) / 60000);
    const flooredOffsetMin = offsetMin - (offsetMin % systemStatusStepMinutes);
    systemStatusAxisEpoch = dayStart.getTime() + flooredOffsetMin * 60000;

    const minutesFrom = (atMs) => (atMs - systemStatusAxisEpoch) / 60000;
    systemStatusMinX = minutesFrom(start);
    systemStatusMaxX = Math.max(systemStatusMinX + systemStatusStepMinutes / 4, minutesFrom(end));
    systemStatusCrossesMidnight = new Date(start).getDate() !== new Date(end).getDate();

    systemStatusAxisTicks = systemStatusTicks(start, end, systemStatusStepMinutes).map((tickAt) => ({
      at: tickAt,
      label: systemStatusAxisLabel(tickAt, systemStatusStepMinutes, { crossesMidnight: systemStatusCrossesMidnight }),
    }));
  }

  const systemStatusSvgX = (atMs) => {
    const minutes = (atMs - systemStatusAxisEpoch) / 60000;
    const ratio = (minutes - systemStatusMinX) / (systemStatusMaxX - systemStatusMinX || 1);
    return SYSTEM_STATUS_PLOT_X0 + ratio * (SYSTEM_STATUS_PLOT_X1 - SYSTEM_STATUS_PLOT_X0);
  };
  const systemStatusSvgY = (value) => 150 - (value / 100) * 120;

  // Unmeasured stretches between segments, drawn as labelled bands so a
  // break in the line explains itself instead of looking like a glitch.
  const systemStatusGaps = [];
  {
    const segments = systemStatusSegments(systemStatusWindowed);
    for (let i = 1; i < segments.length; i++) {
      const prevEnd = segments[i - 1][segments[i - 1].length - 1];
      const nextStart = segments[i][0];
      systemStatusGaps.push({ x1: systemStatusSvgX(prevEnd.at), x2: systemStatusSvgX(nextStart.at) });
    }
  }

  // Latest reading per series, for the end-of-line dot + direct label.
  // Labels are nudged apart (in viewBox units) so close values never stack.
  const systemStatusEnds = (() => {
    const series = [
      { key: 'cpu', field: 'cpu', label: 'CPU' },
      { key: 'mem', field: 'memory', label: 'Memory' },
      { key: 'disk', field: 'disk', label: 'Disk' },
    ];
    const ends = series.flatMap((item) => {
      for (let i = systemStatusWindowed.length - 1; i >= 0; i--) {
        const sample = systemStatusWindowed[i];
        if (sample[item.field] != null) {
          const y = systemStatusSvgY(sample[item.field]);
          return [{ ...item, value: sample[item.field], x: systemStatusSvgX(sample.at), y, labelY: y }];
        }
      }
      return [];
    });
    const MIN_GAP = 13;
    const sorted = [...ends].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].labelY - sorted[i - 1].labelY < MIN_GAP) sorted[i].labelY = sorted[i - 1].labelY + MIN_GAP;
    }
    return ends;
  })();
  const systemStatusLive = hasSystemStatusData && !systemStatusIsStale(systemStatusLastUpdated);

  // A gap between samples draws as a break in the line: a straight line
  // across time that was never measured is a claim the data does not
  // support (system_status_series.dart's systemStatusSegments).
  const getSvgPath = (key) => {
    let d = '';
    for (const segment of systemStatusSegments(systemStatusWindowed)) {
      const points = segment
        .filter((s) => s[key] != null)
        .map((s) => ({ x: systemStatusSvgX(s.at), y: 150 - (s[key] / 100) * 120 }));
      if (points.length === 0) continue;
      points.forEach((point, index) => {
        if (index === 0) {
          d += (d ? ' ' : '') + `M ${point.x} ${point.y}`;
        } else {
          const prev = points[index - 1];
          const cpX = prev.x + (point.x - prev.x) / 2;
          d += ` C ${cpX} ${prev.y}, ${cpX} ${point.y}, ${point.x} ${point.y}`;
        }
      });
    }
    return d;
  };

  const getSvgAreaPath = (key) => {
    let d = '';
    for (const segment of systemStatusSegments(systemStatusWindowed)) {
      const points = segment
        .filter((s) => s[key] != null)
        .map((s) => ({ x: systemStatusSvgX(s.at), y: 150 - (s[key] / 100) * 120 }));
      if (points.length === 0) continue;
      let sub = `M ${points[0].x} ${points[0].y}`;
      points.forEach((point, index) => {
        if (index === 0) return;
        const prev = points[index - 1];
        const cpX = prev.x + (point.x - prev.x) / 2;
        sub += ` C ${cpX} ${prev.y}, ${cpX} ${point.y}, ${point.x} ${point.y}`;
      });
      sub += ` L ${points[points.length - 1].x} 150 L ${points[0].x} 150 Z`;
      d += (d ? ' ' : '') + sub;
    }
    return d;
  };

  const handleMouseMove = (e) => {
    if (!chartRef.current || !hasSystemStatusData) return;
    const rect = chartRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const scaleFactor = 720 / rect.width; // 720 is the SVG viewBox width
    const svgX = clientX * scaleFactor;

    // Find the closest sample based on x coordinate
    let closestSample = systemStatusWindowed[0];
    let closestX = systemStatusSvgX(closestSample.at);
    let minDiff = Math.abs(closestX - svgX);
    systemStatusWindowed.forEach((sample) => {
      const sampleX = systemStatusSvgX(sample.at);
      const diff = Math.abs(sampleX - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestSample = sample;
        closestX = sampleX;
      }
    });

    const closestPoint = {
      x: closestX,
      time: systemStatusTooltipTimestamp(closestSample.at),
      cpu: closestSample.cpu != null ? closestSample.cpu.toFixed(1) : '--',
      mem: closestSample.memory != null ? closestSample.memory.toFixed(1) : '--',
      disk: closestSample.disk != null ? closestSample.disk.toFixed(1) : '--',
    };
    setHoveredData(closestPoint);
    // Position tooltip relative to container width/height. The tooltip sits
    // above the hovered point (CSS translate(-50%, -100%)), so its own
    // rendered height needs room above `y` -- clamp so a spike near the top
    // of the chart doesn't push it above the container and out of view.
    // Reads the previous render's actual height off the ref rather than a
    // guessed constant, since the tooltip's height isn't fixed (varies with
    // how much text each row wraps to). heightScale also corrects this to
    // actually track the container's rendered height instead of assuming
    // it's exactly 172px tall (the SVG viewBox height), the way the x
    // position already scales by rect.width.
    const heightScale = rect.height / 172; // 172 = SVG viewBox height
    const anchorValue = closestSample.cpu ?? closestSample.memory ?? closestSample.disk ?? 0;
    const pointY = (150 - (anchorValue / 100) * 120) * heightScale;
    const tooltipHeight = chartTooltipRef.current?.offsetHeight || 90;
    setTooltipPos({
      x: (closestX / 720) * rect.width,
      y: Math.max(pointY - 40, tooltipHeight + 8)
    });
  };

  // Today's CPU/Mem/Disk samples (midnight -> now), drawn as small
  // sparklines in the Dashboard's System Health rail. Reads the same
  // systemStatusSamples series the System Status chart uses; samples store
  // memory as `memory`, the health rows key it as `mem`.
  const todayStartMs = new Date().setHours(0, 0, 0, 0);
  const todaysSamples = systemStatusSamples.filter((s) => s.at >= todayStartMs);

  const getSparklinePath = (key, width = 100, height = 24) => {
    const field = key === 'mem' ? 'memory' : key;
    const points = todaysSamples.filter((s) => s[field] != null);
    const n = points.length;
    if (n < 2) return '';
    return points.map((pt, i) => {
      const v = Math.min(100, Math.max(0, Number(pt[field]) || 0));
      const x = (i / (n - 1)) * width;
      const y = height - 2 - (v / 100) * (height - 4);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  const renderDummyPage = (title, description, { inlineDescription = false } = {}) => {
    return (
      <div className="workspace-dummy-view neon-panel-glow">
        <div className="dummy-view-header">
          <h2>
            {title}
            {!inlineDescription && <InfoHint label={`About ${title}`}>{description}</InfoHint>}
          </h2>
          {inlineDescription && <p style={{ margin: '4px 0 0', color: 'var(--text-sub)' }}>{description}</p>}
        </div>
        <div className="dummy-view-body">
          <div className="dummy-metric-grid">
            <div className="dummy-metric-card">
              <span className="metric-title">{t('STATUS')}</span>
              <span className="metric-value text-glow-blue">{t('Operational')}</span>
            </div>
            <div className="dummy-metric-card">
              <span className="metric-title">{t('TOTAL ITEMS')}</span>
              <span className="metric-value text-glow-purple">12 {t('Active')}</span>
            </div>
            <div className="dummy-metric-card">
              <span className="metric-title">{t('LAST SYNC')}</span>
              <span className="metric-value text-glow-green">{t('Just now')}</span>
            </div>
          </div>

          <div className="dummy-table-container">
            <table className="dummy-table">
              <thead>
                <tr>
                  <th>{t('ID')}</th>
                  <th>{t('Name')}</th>
                  <th>{t('Type / Group')}</th>
                  <th>{t('Status')}</th>
                  <th>{t('Last Modified')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>#1001</td>
                  <td>System Default Rule</td>
                  <td>Primary Config</td>
                  <td><span className="badge-glow-green">{t('Active')}</span></td>
                  <td>10 mins ago</td>
                </tr>
                <tr>
                  <td>#1002</td>
                  <td>Backup Gateway Route</td>
                  <td>Secondary Bridge</td>
                  <td><span className="badge-glow-green">{t('Active')}</span></td>
                  <td>1 hour ago</td>
                </tr>
                <tr>
                  <td>#1003</td>
                  <td>Test Campaign Sandbox</td>
                  <td>Temporary Group</td>
                  <td><span className="badge-glow-orange">{t('Pending')}</span></td>
                  <td>Yesterday</td>
                </tr>
                <tr>
                  <td>#1004</td>
                  <td>Bypass Router Chain</td>
                  <td>System Core</td>
                  <td><span className="badge-glow-red">{t('Disabled')}</span></td>
                  <td>June 15, 2026</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Apps menu -- matches Flutter's SoftphoneAppsPage exactly
  // (softPhonesApp.dart:7-467): 6 static download/link cards, no API/config,
  // each icon + text link opens the same external URL in a new tab via
  // url_launcher's LaunchMode.externalApplication. The Mac card's text-link
  // URL in the Dart source has a "hhttps://" typo (softPhonesApp.dart:309);
  // fixed here to the correct URL (same one the Mac card's icon button uses).
  // Grouped into sections on render; `meta` is the store/platform line and
  // `actionLabel` names what the button does.
  const APPS_MENU_SECTIONS = [
    { key: 'mobile', title: 'Mobile', apps: ['ios', 'android'] },
    { key: 'desktop', title: 'Desktop', apps: ['windows', 'mac'] },
    { key: 'web', title: 'Browser & website', apps: ['chrome', 'wordpress'] },
  ];

  const APPS_MENU_CARDS = [
    {
      key: 'ios',
      title: 'iOS App',
      icon: 'bxl-apple',
      url: 'https://apps.apple.com/gb/app/ringq/id6468941160',
      meta: 'iPhone · App Store',
      actionLabel: 'View on App Store',
    },
    {
      key: 'android',
      title: 'Android App',
      icon: 'bxl-android',
      url: 'https://play.google.com/store/apps/details?id=com.ringq.app',
      meta: 'Android · Google Play',
      actionLabel: 'View on Google Play',
    },
    {
      key: 'windows',
      title: 'Windows Desktop',
      icon: 'bxl-windows',
      url: 'https://apps.microsoft.com/detail/9mvnmt2w4nl6?hl=en-GB&gl=SG',
      meta: 'Windows · Microsoft Store',
      actionLabel: 'View on Microsoft Store',
    },
    {
      key: 'mac',
      title: 'macOS Desktop',
      icon: 'bxl-apple',
      url: 'https://apps.apple.com/gb/app/ringq-desktop/id6761712376?mt=12',
      meta: 'Mac · Mac App Store',
      actionLabel: 'View on Mac App Store',
    },
    {
      key: 'chrome',
      title: 'Chrome Extension',
      icon: 'bxl-chrome',
      url: 'https://chromewebstore.google.com/search/ringq',
      actionLabel: 'Find on Chrome Web Store',
    },
    {
      key: 'wordpress',
      title: 'WordPress Plugin',
      icon: 'bxl-wordpress',
      url: 'https://wordpress.org/plugins/ringq-chat-app/',
      actionLabel: 'View on WordPress.org',
    },
  ];

  const renderAppsPage = () => {
    const appsByKey = Object.fromEntries(APPS_MENU_CARDS.map(app => [app.key, app]));
    return (
      <div className="apps-page-container">
        <header className="apps-page-header">
          <h1 className="apps-page-title">
            {t('Apps')}
            <InfoHint label={`About ${t('Apps')}`}>
              {t('Take RingQ to your phone and desktop, and into your browser and website.')}
            </InfoHint>
          </h1>
        </header>

        <div className="apps-page-sections">
          {APPS_MENU_SECTIONS.map(section => (
            <section key={section.key} className="apps-page-section" aria-labelledby={`apps-section-${section.key}`}>
              <h2 id={`apps-section-${section.key}`} className="apps-page-section-title">{t(section.title)}</h2>
              <ul className="apps-page-list">
                {section.apps.map(key => {
                  const app = appsByKey[key];
                  return (
                    <li key={app.key} className="apps-page-item">
                      <span className="apps-page-item-icon" aria-hidden="true">
                        <i className={`bx ${app.icon}`}></i>
                      </span>
                      <div className="apps-page-item-main">
                        <h3 className="apps-page-item-title">{app.title}</h3>
                        {app.meta && <div className="apps-page-item-meta">{app.meta}</div>}
                      </div>
                      <a
                        className="apps-page-item-action"
                        href={app.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <i className={`bx ${app.download ? 'bx-download' : 'bx-link-external'}`} aria-hidden="true"></i>
                        <span>{app.actionLabel}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    );
  };

  // Call Status page -- matches Flutter's 3-tab UI in home.dart
  // (Active Calls/Failed Calls/Online Extensions + a "Previous Calls" table
  // nested under Active Calls). Columns and data source confirmed against
  // both the Dart source (home.dart:12324-12742, socket events at
  // home.dart:3094-3236) and the live app (team.ringq.ai): the live
  // Failed Calls tab only shows 8 of the 11 columns Dart defines (no
  // Duration/Status/Action) -- reproduced here as observed live.

  const formatEpochTime = (epoch) => {
    const n = Number(epoch);
    if (!epoch || Number.isNaN(n)) return '';
    return new Date(n * 1000).toLocaleTimeString('en-GB', { hour12: false });
  };

  // Route column -- matches Flutter's gateway resolution (home.dart:5878,
  // 5895-5906): `row.gateway` is a gateway UUID, not a display name, so it
  // has to be looked up in the `gateways` bootstrap list; only falling back
  // to the raw `row.route` field when there's no gateway id or no match.
  const resolveCallRoute = (row) => {
    const gatewayId = row.gateway;
    if (gatewayId) {
      const match = gateways.find(g => g && String(g.uuid) === String(gatewayId));
      if (match) return String(match.gateway);
    }
    return String(row.route || 'NA');
  };

  // Direction is derived from the call's own numbers, never from the server's `direction` /
  // `call_direction` field: FreeSWITCH reports the *leg* direction, so every call that originates
  // from a SIP/WebRTC endpoint (the dialer, a desk phone) arrives flagged "inbound" -- which is
  // why a call placed from the dialer showed Inbound. Flutter (home.dart:5871) ignores that field
  // too and uses `dest.length > 4 ? Outbound : Inbound`; this keeps that rule and adds two
  // guards for what it gets wrong: a 5-6 digit internal extension, and a call that arrives on one
  // of the tenant's own DIDs, are both Inbound.
  const callDirectionOf = (row) => {
    const digits = (v) => String(v ?? '').replace(/\D/g, '');
    const dest = digits(row.dest ?? row.callee);
    if (!dest) return '';
    if (extensions.some((e) => e && digits(e.extension) === dest)) return 'Inbound';
    if (dids.some((d) => {
      const n = digits(d?.did_number);
      return n && (n === dest || n.endsWith(dest) || dest.endsWith(n));
    })) return 'Inbound';
    return dest.length > 4 ? 'Outbound' : 'Inbound';
  };

  // Queue a call belongs to. Finished calls carry queue_ext/queue_name from the server's call
  // journey; live rows only carry the "(9036)" marker the queue dialplan puts in the caller
  // name, so fall back to that and resolve the name from the tenant's queue list.
  const QUEUE_MARK_RE = /\(\s*(9\d{3})\s*\)/;
  const queueLabelOf = (row) => {
    let ext = String(row.queue_ext || '');
    if (!ext) {
      for (const v of [row.cc_queue, row.cid_name, row.b_cid_name, row.callee_name, row.b_callee_name]) {
        const str = String(v || '');
        const m = str.match(QUEUE_MARK_RE) || str.match(/^(9\d{3})@/);
        if (m) { ext = m[1]; break; }
      }
    }
    if (!ext) return '';
    const name = String(row.queue_name || queues.find((q) => String(q.queue_extension) === ext)?.queue_name || '').trim();
    return name ? `${name} (${ext})` : `Queue ${ext}`;
  };
  const formatWait = (sec) => {
    if (sec == null || sec === '' || Number.isNaN(Number(sec))) return '';
    const n = Math.max(0, Math.round(Number(sec)));
    return n < 60 ? `${n}s` : `${Math.floor(n / 60)}m ${String(n % 60).padStart(2, '0')}s`;
  };

  // Call-type colour code (Call Status + dashboard): Queue / Inbound / Outbound / Fax / Internal.
  // The type comes from the server's call journey; rows without one (older or not yet
  // recorded) fall back to what the row itself shows.
  const CALL_TYPE_META = {
    queue: { label: 'Queue', color: '#7a5af8' },
    inbound: { label: 'Inbound', color: '#1ea5e1' },
    outbound: { label: 'Outbound', color: '#f79009' },
    fax: { label: 'Fax', color: '#0e9384' },
    internal: { label: 'Internal', color: '#98a2b3' },
  };
  const CALL_TYPE_FALLBACK_LABEL = {
    queue: 'Queue call',
    internal: 'Extension call',
    inbound: 'Inbound call',
    outbound: 'Outbound call',
    fax: 'Fax call',
  };
  const callTypeOf = (row, jr) => {
    const t = String(jr?.call_type || '').toLowerCase();
    if (CALL_TYPE_META[t]) return t;
    if (queueLabelOf({ ...row, queue_ext: jr?.queue_ext || row.queue_ext })) return 'queue';
    if (/fax/i.test(String(row.status || '')) || /fax/i.test(String(row.cid_name || ''))) return 'fax';
    const dir = callDirectionOf(row);
    if (dir === 'Outbound') return 'outbound';
    const digits = String(row.cid_num ?? row.caller ?? '').replace(/\D/g, '');
    const isExt = (n) => extensions.some((e) => e && String(e.extension) === n);
    return digits && isExt(digits) && isExt(String(row.dest ?? row.callee ?? '')) ? 'internal' : 'inbound';
  };
  const renderCallTypeLegend = () => (
    <div className="cs-type-legend" aria-label="Call type colours">
      {Object.entries(CALL_TYPE_META).map(([key, meta]) => (
        <span key={key} className="cs-type-legend-item">
          <span className="cs-swatch" style={{ backgroundColor: meta.color }} aria-hidden="true" />
          {meta.label}
        </span>
      ))}
    </div>
  );

  const mapCallRow = (row) => {
    // Finished rows carry their journey; live rows get it from liveJourneys.
    const jr = Array.isArray(row.timeline) ? row : (liveJourneys[String(row.uuid)] || liveJourneys[String(row.b_uuid)] || {});
    return {
      uuid: row.uuid,
      time: row.time || formatEpochTime(row.created_epoch),
      callType: callTypeOf(row, jr),
      color: CALL_TYPE_META[callTypeOf(row, jr)].color,
      direction: callDirectionOf(row),
      caller: resolveCallParticipantId(row.cid_num ?? row.caller ?? row.caller_id ?? ''),
      callee: String(row.dest ?? row.callee ?? ''),
      // `callstate` is always empty in real payloads; `hangUpCause` (e.g.
      // "NORMAL_CLEARING", "UNALLOCATED_NUMBER") is the actual populated
      // field and is what the Type column reads for Failed Calls in
      // particular, where it's the only outcome/reason column shown.
      type: String(row.type || row.hangUpCause || row.callstate || ''),
      duration: row.duration != null ? String(row.duration) : '',
      status: String(row.status || row.callstate || ''),
      rule: String(row.rule || 'NA'),
      route: resolveCallRoute(row),
      // Call-journey fields (server.js [call-journey]); empty for rows recorded before it existed.
      queue: queueLabelOf({ ...row, queue_ext: jr.queue_ext || row.queue_ext, queue_name: jr.queue_name || row.queue_name }),
      answeredBy: jr.answered_by ? `${jr.answered_by}${jr.answered_name ? ` · ${jr.answered_name}` : ''}` : '',
      wait: formatWait(jr.wait_sec),
      statusText: String(jr.status_text || ''),
      outcome: String(jr.outcome || ''),
      timeline: Array.isArray(jr.timeline) ? jr.timeline : [],
    };
  };

  // Expandable call-journey timeline row, shared by Active Calls and Previous Calls.
  const renderJourneyRow = (item, colSpan) => (
    <tr className="cs-journey-row">
      <td colSpan={colSpan}>
        <ol className="cs-journey" aria-label="Call journey">
          {item.timeline.map((stepItem, sIdx) => (
            <li key={sIdx} className={`cs-journey-step cs-step-${stepItem.step}`}>
              <span className="cs-journey-time">{formatEpochTime(Math.floor(Number(stepItem.t) / 1000))}</span>
              <span className="cs-journey-dot" aria-hidden="true"></span>
              <span className="cs-journey-text">{stepItem.text}</span>
            </li>
          ))}
        </ol>
      </td>
    </tr>
  );
  const journeyRowProps = (hasJourney, isOpen, toggle) => ({
    className: `${hasJourney ? 'cs-row-clickable' : ''} ${isOpen ? 'cs-row-open' : ''}`,
    onClick: (e) => { if (e.target.closest && e.target.closest('button')) return; toggle(); },
    onKeyDown: (e) => { if (hasJourney && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); toggle(); } },
    tabIndex: hasJourney ? 0 : undefined,
    'aria-expanded': hasJourney ? isOpen : undefined,
    title: hasJourney ? 'Show call journey' : undefined,
  });

  const CALL_STATUS_UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const matchUuidInText = (value) => {
    if (typeof value !== 'string') return null;
    const m = value.match(CALL_STATUS_UUID_RE);
    return m ? m[0] : null;
  };

  const formatExpiresCountdown = (expiresVal) => {
    const n = Number(expiresVal);
    if (!expiresVal || Number.isNaN(n)) return '';
    const diffSec = n > 1e9 ? Math.max(0, n - Math.floor(Date.now() / 1000)) : Math.max(0, n);
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = Math.floor(diffSec % 60);
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  };

  // Field shape confirmed live against a real GET /api/index response (see
  // components/connections.tsx, which reads this same onlineExtensions
  // payload for the "Assigned Phones" table): entries carry reg_user (a SIP
  // username, NOT the extension number -- resolve via extensions[].username
  // -> extensions[].extension), realm (device/client label -- what actually
  // ends up in the "User Agent" column live), network_ip/network_port, url,
  // expires. There is no live user_agent or sip_user field on this backend.
  const mapExtensionRow = (row, extensionByUsername) => {
    const ext = extensionByUsername.get(String(row.reg_user));
    const uuid = matchUuidInText(row.user_agent) || matchUuidInText(row.realm);
    const url = String(row.url || '').toLowerCase();
    return {
      extension: String(ext?.extension || row.reg_user || ''),
      banId: uuid,
      userAgent: String(row.realm || ''),
      ip: String(row.network_ip ?? row.ip ?? ''),
      port: String(row.network_port ?? row.port ?? ''),
      status: String(row.network_proto || '').toUpperCase() || (url.includes('wss') ? 'WSS' : url.includes('tcp') ? 'TCP' : ''),
      expires: formatExpiresCountdown(row.expires),
      raw: row,
    };
  };

  // Hoisted out of renderCallStatusPage so the Dashboard's own Active Calls table (which
  // renders on a completely different branch of the page switch, not nested inside that
  // function) can trigger the exact same hang-up confirmation -- same function, same
  // confirmation copy, same socket action, wherever the table is shown.
  const confirmHangup = (uuid) => setCallActionConfirm({
    type: 'kill',
    message: 'You are about to end this active call. Do you wish to continue?',
    onConfirm: () => {
      socketService.emit('killChannel', uuid);
      // Drop the row right away instead of waiting for the next ringProgress push, and remember
      // the uuid for a few seconds so a push that was already in flight can't bring it back.
      if (uuid) hungUpUuidsRef.current.set(String(uuid), Date.now());
      setActiveCalls((prev) => prev.filter((r) => String(r?.uuid) !== String(uuid)));
    },
  });

  const confirmBan = (row) => setCallActionConfirm({
    type: 'ban',
    message: `You are about to ban ${row.extension}. Do you wish to continue?`,
    onConfirm: () => socketService.emit('banUuid', row.banId),
  });

  // Active Calls table -- shared verbatim between the Call Status page's "Active Calls" tab
  // and the Dashboard's own Active Calls widget (previously a hardcoded, always-"No calls in
  // progress" stub there with no data binding at all, and an extra "Outbound Id" column the
  // real table doesn't have). `rows` is already mapCallRow()-mapped (and, on the Call Status
  // page, search-filtered); the Dashboard passes every current active call unfiltered.
  // Shared cell renderers for every Call Status table (and the Dashboard's copy).
  const csText = (value) => value || <span className="cs-muted" aria-label="None">—</span>;
  const csSwatch = (color, label) => (
    <span className="cs-swatch" style={{ backgroundColor: color }} title={label || undefined} aria-label={label || undefined} role={label ? 'img' : undefined} aria-hidden={label ? undefined : 'true'} />
  );
  const csDirection = (direction) => {
    if (!direction) return csText('');
    const kind = direction.toLowerCase();
    return (
      <span className={`cs-pill cs-dir-${kind === 'inbound' || kind === 'outbound' ? kind : 'other'}`}>
        {direction}
      </span>
    );
  };

  // ---- compact Call Status cells (fits 13" screens: 9-10 columns instead of 14) ----
  const csFromTo = (item) => (
    <span className="cs-fromto">
      <span className="cs-strong">{item.caller || '—'}</span>
      <span className="cs-arrow" aria-label="to">→</span>
      <span className="cs-strong">{item.callee && item.callee !== 'false' ? item.callee : '—'}</span>
    </span>
  );
  const csRuleRoute = (item) => {
    const rule = item.rule && item.rule !== 'NA' ? item.rule : '';
    const route = item.route && item.route !== 'NA' ? item.route : '';
    // No rule/route (e.g. extension-to-extension or queue calls): name the call type instead.
    if (!rule && !route) return <span className="cs-muted">{CALL_TYPE_FALLBACK_LABEL[item.callType] || '—'}</span>;
    return (
      <span className="cs-stack" title={[rule && `Rule: ${rule}`, route && `Route: ${route}`].filter(Boolean).join(' · ')}>
        <span>{rule || '—'}</span>
        {route && <span className="cs-small cs-muted">{route}</span>}
      </span>
    );
  };
  const csAnswered = (item) => {
    if (!item.answeredBy) return csText('');
    const [ext, name] = item.answeredBy.split(' · ');
    const first = String(name || '').split(/\s+/)[0];
    return <span title={item.answeredBy}>{first ? `${ext} · ${first}` : ext}</span>;
  };
  const csDur = (sec) => {
    const n = Number(sec);
    if (sec === '' || sec == null || Number.isNaN(n)) return '';
    return `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
  };
  const csWaitDur = (item) => (
    <span className="cs-num">{item.wait || '—'}<span className="cs-muted"> / </span>{csDur(item.duration) || '—'}</span>
  );
  const csCause = (item) => (item.type && item.type !== 'NORMAL_CLEARING'
    ? <span className="cs-cause">{item.type.toLowerCase().replace(/_/g, ' ')}</span>
    : null);
  // call-type colour as a bar on the row's first cell (replaces the Color column)
  const csTypeBar = (item) => ({ boxShadow: `inset 4px 0 0 ${item.color}` });

  const renderActiveCallsTable = (rows, emptyText = 'No calls in progress') => (
    <div className="call-status-table-wrapper">
      <table className="call-status-table">
        <thead>
          <tr>
            <th className="cs-col-expand" aria-label="Details"></th>
            <th>Time</th>
            <th>Direction</th>
            <th>From → To</th>
            <th>Queue</th>
            <th>Answered By</th>
            <th>Duration</th>
            <th>Status</th>
            <th className="cs-col-action">Action</th>
            <th>Rule / Route</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((item, idx) => {
              const rowKey = item.uuid || `live-${idx}`;
              const hasJourney = item.timeline.length > 0;
              const isOpen = hasJourney && expandedLiveCall === rowKey;
              const toggle = () => { if (hasJourney) setExpandedLiveCall(isOpen ? null : rowKey); };
              return (
                <React.Fragment key={rowKey}>
                  <tr {...journeyRowProps(hasJourney, isOpen, toggle)}>
                    <td className="cs-col-expand" style={csTypeBar(item)} title={CALL_TYPE_META[item.callType]?.label}>
                      {hasJourney && <i className={`bx ${isOpen ? 'bx-chevron-down' : 'bx-chevron-right'}`} aria-hidden="true"></i>}
                    </td>
                    <td className="cs-num">{csText(item.time)}</td>
                    <td>{csDirection(item.direction)}</td>
                    <td className="cs-num">{csFromTo(item)}</td>
                    <td>{item.queue ? <span className="cs-queue-tag">{item.queue}</span> : csText('')}</td>
                    <td>{csAnswered(item)}</td>
                    <td className="cs-num">{csText(csDur(item.duration))}</td>
                    <td className="cs-status-cell">
                      {item.statusText
                        ? <span className={`cs-outcome cs-outcome-${item.outcome || 'live'}`}><span className="cs-live-dot" aria-hidden="true" />{item.statusText}</span>
                        : item.status
                          ? <span className="cs-pill cs-status-live"><span className="cs-live-dot" aria-hidden="true" />{item.status}</span>
                          : csText('')}
                    </td>
                    <td className="cs-col-action">
                      <button
                        type="button"
                        className="cs-icon-btn danger"
                        title="Hang up"
                        aria-label={`Hang up call from ${item.caller || 'unknown'} to ${item.callee || 'unknown'}`}
                        onClick={() => confirmHangup(item.uuid)}
                      >
                        <i className="bx bx-phone-off" aria-hidden="true"></i>
                      </button>
                    </td>
                    <td>{csRuleRoute(item)}</td>
                  </tr>
                  {isOpen && renderJourneyRow(item, 10)}
                </React.Fragment>
              );
            })
          ) : (
            <tr>
              <td colSpan={10} className="cs-empty">{emptyText}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderCallStatusPage = () => {
    const filterText = callStatusSearch.toLowerCase();

    const extensionByUsername = new Map();
    viewExtensions.forEach(ext => { if (ext && ext.username) extensionByUsername.set(String(ext.username), ext); });

    // [user-role] a User (permission 10) sees only calls that involve their own extension:
    // dialled by them, to them, answered by them, or queue calls that rang / were routed to them.
    const isUserRole = parseInt(permissionMode, 10) === 10;
    const ownExt = String(userSession?.extension ?? '');
    const ownUsers = new Set([ownExt, String(userSession?.username ?? '')].filter(Boolean));
    viewExtensions.forEach(ext => { if (ext && String(ext.extension) === ownExt && ext.username) ownUsers.add(String(ext.username)); });
    const userPart = (v) => String(v ?? '').split('@')[0];
    const extWord = ownExt ? new RegExp(`(^|\\D)${ownExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\D|$)`) : null;
    const callIsMine = (row) => {
      if (!ownExt) return false;
      const jr = Array.isArray(row.timeline) ? row : (liveJourneys[String(row.uuid)] || liveJourneys[String(row.b_uuid)] || {});
      const ids = [row.cid_num, row.caller, row.caller_id, row.dest, row.callee, row.callee_num, row.b_cid_num, row.b_dest,
      row.b_callee_num, row.answered_by, jr.answered_by, userPart(row.presence_id), userPart(row.b_presence_id)];
      if (ids.some((v) => v != null && ownUsers.has(String(v)))) return true;
      const steps = Array.isArray(jr.timeline) ? jr.timeline : [];
      return Boolean(extWord) && steps.some((st) => extWord.test(String(st && st.text || '')));
    };
    const scopeCalls = (rows) => (isUserRole ? rows.filter(callIsMine) : rows);

    const mappedActive = scopeCalls(activeCalls).map(mapCallRow);
    const mappedFailed = scopeCalls(failedCalls).map(mapCallRow);
    const mappedPrevious = scopeCalls(previousCalls).map(mapCallRow);
    const mappedOnline = viewOnlineExtensions.map(row => mapExtensionRow(row, extensionByUsername));

    const matchesCall = (item) =>
      item.caller.toLowerCase().includes(filterText) ||
      item.callee.toLowerCase().includes(filterText) ||
      item.type.toLowerCase().includes(filterText) ||
      item.status.toLowerCase().includes(filterText) ||
      item.statusText.toLowerCase().includes(filterText) ||
      item.queue.toLowerCase().includes(filterText) ||
      item.answeredBy.toLowerCase().includes(filterText) ||
      item.route.toLowerCase().includes(filterText);

    const filteredActive = mappedActive.filter(matchesCall);
    const filteredFailed = mappedFailed.filter(matchesCall);
    const filteredPrevious = mappedPrevious.filter(matchesCall);

    const filteredOnline = mappedOnline.filter(item =>
      item.extension.toLowerCase().includes(filterText) ||
      item.userAgent.toLowerCase().includes(filterText) ||
      item.ip.toLowerCase().includes(filterText)
    );

    const searching = filterText.trim() !== '';
    const emptyText = (none) => (searching ? `Nothing matches "${callStatusSearch.trim()}"` : none);
    const showOnlineTab = permissionMode !== 10;
    // [user-role] no Failed Calls tab for Owner (7) and User (10)
    const showFailedTab = ![7, 10].includes(parseInt(permissionMode, 10));
    const tabs = [
      { key: 'active', label: 'Active Calls', count: mappedActive.length },
      ...(showFailedTab ? [{ key: 'failed', label: 'Failed Calls', count: mappedFailed.length }] : []),
      ...(showOnlineTab ? [{ key: 'online', label: 'Online Extensions', count: mappedOnline.length }] : []),
    ];
    const shownTab = tabs.some((tb) => tb.key === callStatusTab) ? callStatusTab : 'active';
    const selectTab = (key) => {
      setCallStatusTab(key);
      // Matches Flutter's TabBar.onTap (home.dart:12056-12061):
      // re-requests a fresh failed-calls snapshot on tab select.
      if (key === 'failed') socketService.emit('failedActive', '');
    };

    return (
      <div className="call-status-page-container">
        <header className="cs-header">
          <h1 className="cs-title">{t('Call Status')}</h1>
          <label className="cs-search">
            <i className="bx bx-search" aria-hidden="true"></i>
            <input
              type="search"
              aria-label="Search calls and extensions"
              placeholder="Search number, type, route"
              value={callStatusSearch}
              onChange={(e) => setCallStatusSearch(e.target.value)}
            />
            {callStatusSearch && (
              <button type="button" className="cs-search-clear" aria-label="Clear search" onClick={() => setCallStatusSearch('')}>
                <i className="bx bx-x" aria-hidden="true"></i>
              </button>
            )}
          </label>
        </header>

        <CallStatusTabs tabs={tabs} active={shownTab} onSelect={selectTab} />
        {shownTab !== 'online' && renderCallTypeLegend()}

        {/* Keyed on the tab so switching remounts it and replays the quick
            fade-in (live data updates keep the key, so they don't flash). */}
        <div className="cs-tab-panel" key={shownTab} role="tabpanel">
          {shownTab === 'active' && (
            <>
              {renderActiveCallsTable(filteredActive, emptyText('No calls in progress'))}

              <section className="cs-section" aria-labelledby="cs-previous-heading">
                <h2 className="cs-section-title" id="cs-previous-heading">
                  Previous Calls
                  <span className="cs-tab-count">{mappedPrevious.length}</span>
                </h2>
                <div className="call-status-table-wrapper">
                  <table className="call-status-table cs-previous-table">
                    <thead>
                      <tr>
                        <th className="cs-col-expand" aria-label="Details"></th>
                        <th>Time</th>
                        <th>Direction</th>
                        <th>From → To</th>
                        <th>Queue</th>
                        <th>Answered By</th>
                        <th title="Time waiting in queue / call duration">Wait / Dur</th>
                        <th>Status</th>
                        <th>Rule / Route</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPrevious.length > 0 ? (
                        filteredPrevious.map((item, idx) => {
                          const rowKey = item.uuid || `prev-${idx}`;
                          const hasJourney = item.timeline.length > 0;
                          const isOpen = hasJourney && expandedPrevCall === rowKey;
                          const toggle = () => { if (hasJourney) setExpandedPrevCall(isOpen ? null : rowKey); };
                          return (
                            <React.Fragment key={rowKey}>
                              <tr {...journeyRowProps(hasJourney, isOpen, toggle)}>
                                <td className="cs-col-expand" style={csTypeBar(item)} title={CALL_TYPE_META[item.callType]?.label}>
                                  {hasJourney && <i className={`bx ${isOpen ? 'bx-chevron-down' : 'bx-chevron-right'}`} aria-hidden="true"></i>}
                                </td>
                                <td className="cs-num">{csText(item.time)}</td>
                                <td>{csDirection(item.direction)}</td>
                                <td className="cs-num">{csFromTo(item)}</td>
                                <td>{item.queue ? <span className="cs-queue-tag">{item.queue}</span> : csText('')}</td>
                                <td>{csAnswered(item)}</td>
                                <td>{csWaitDur(item)}</td>
                                <td className="cs-status-cell">
                                  {item.statusText
                                    ? <span className={`cs-outcome cs-outcome-${item.outcome || 'ended'}`}>{item.statusText}</span>
                                    : item.status ? <span className="cs-pill">{item.status}</span> : csText('')}
                                  {csCause(item)}
                                </td>
                                <td>{csRuleRoute(item)}</td>
                              </tr>
                              {isOpen && renderJourneyRow(item, 9)}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={9} className="cs-empty">{emptyText('No finished calls yet')}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {shownTab === 'failed' && showFailedTab && (
            <div className="call-status-table-wrapper">
              <table className="call-status-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Color</th>
                    <th>Direction</th>
                    <th>Caller</th>
                    <th>Callee</th>
                    <th>Type</th>
                    <th>Rule</th>
                    <th>Route</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFailed.length > 0 ? (
                    filteredFailed.map((item, idx) => (
                      <tr key={item.uuid || idx}>
                        <td className="cs-num">{csText(item.time)}</td>
                        <td>{csSwatch(item.color, CALL_TYPE_META[item.callType]?.label)}</td>
                        <td>{csDirection(item.direction)}</td>
                        <td className="cs-num cs-strong">{csText(item.caller)}</td>
                        <td className="cs-num cs-strong">{csText(item.callee)}</td>
                        <td>{item.type ? <span className="cs-pill cs-status-failed">{item.type}</span> : csText('')}</td>
                        <td>{csText(item.rule)}</td>
                        <td>{csText(item.route)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="cs-empty">{emptyText('No failed calls')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {shownTab === 'online' && showOnlineTab && (
            <div className="call-status-table-wrapper">
              <table className="call-status-table">
                <thead>
                  <tr>
                    <th>Extension</th>
                    <th>User Agent</th>
                    <th>IP</th>
                    <th>Port</th>
                    <th>Status</th>
                    <th className="cs-col-action">Action</th>
                    <th>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOnline.length > 0 ? (
                    filteredOnline.map((item, idx) => (
                      <tr key={idx}>
                        <td className="cs-num cs-strong">{csText(item.extension)}</td>
                        <td className="cs-wrap">{csText(item.userAgent)}</td>
                        <td className="cs-num">{csText(item.ip)}</td>
                        <td className="cs-num">{csText(item.port)}</td>
                        <td>{item.status ? <span className="cs-pill">{item.status}</span> : csText('')}</td>
                        <td className="cs-col-action">
                          <button
                            type="button"
                            className="cs-icon-btn danger"
                            title={item.banId ? 'Ban device' : 'Unable to identify device'}
                            aria-label={item.banId ? `Ban extension ${item.extension}'s device` : 'Unable to identify device'}
                            disabled={!item.banId}
                            onClick={() => confirmBan(item)}
                          >
                            <i className="bx bx-block" aria-hidden="true"></i>
                          </button>
                        </td>
                        <td className="cs-num">{csText(item.expires)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="cs-empty">{emptyText('No devices registered')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Favorite toggle for Team Directory -- no REST endpoint exists for this
  // (matches Flutter): optimistic local update + a socket emit that the
  // backend picks up, mirrored across the user's other logged-in devices.
  const toggleFavorite = (extension, currentlyFavorite) => {
    setFavorites(prev => currentlyFavorite ? prev.filter(e => e !== extension) : [...prev, extension]);
    socketService.emit(currentlyFavorite ? 'unfavorite' : 'favorite', extension);
  };

  // Live data once /api/index has answered, otherwise the cached copy.
  const usingCachedDirectory = extensions.length === 0 && !!cachedDirectory;
  const viewExtensions = usingCachedDirectory ? cachedDirectory.extensions : extensions;
  const viewTeams = usingCachedDirectory ? cachedDirectory.teams : teams;
  const viewFavorites = usingCachedDirectory ? cachedDirectory.favorites : favorites;
  const viewOnlineExtensions = onlineExtensions.length === 0 && cachedDirectory ? cachedDirectory.onlineExtensions : onlineExtensions;
  const viewServerResources = serverResources || cachedDirectory?.serverResources || null;
  // My Profile: until /api/index answers, the last-seen QR Code / Settings gates and the
  // user's own devices / DIDs (null = nothing cached, so the page shows loading instead).
  const profileDataLoaded = !!dashboardData;
  const cachedProfileFlags = cachedDirectory?.profileFlags || {};
  const viewAppEnabled = profileDataLoaded ? appEnabled : !!(cachedProfileFlags.appEnabled ?? appEnabled);
  const viewWebappEnabled = profileDataLoaded ? webappEnabled : !!(cachedProfileFlags.webappEnabled ?? webappEnabled);
  const viewCallcontrolEnabled = profileDataLoaded ? callcontrolEnabled : !!(cachedProfileFlags.callcontrolEnabled ?? callcontrolEnabled);

  // ---- App search data (all in memory, so results are instant) ----
  const allSearchMenus = [...getPrimaryMenus(), ...getSecondaryMenus()];
  const canOpenRoute = (route) =>
    allSearchMenus.some((m) => m.routePath === route || (m.children || []).some((c) => c.routePath === route));
  const searchPages = (() => {
    const out = [];
    const seen = new Set();
    const add = (item, parent) => {
      const key = item.routePath || `title:${item.title}`;
      if (seen.has(key)) return;
      seen.add(key);
      const base = { key, title: t(item.title), icon: item.icon, parent: parent && t(parent), routePath: item.routePath };
      if (item.externalUrl) {
        out.push({ ...base, run: () => window.open(item.externalUrl, '_blank', 'noopener,noreferrer') });
      } else if (item.onSelect) {
        out.push({ ...base, run: item.onSelect });
      } else if (item.routePath) {
        out.push({ ...base, run: () => setActivePage(item.routePath) });
      }
    };
    allSearchMenus.forEach((menu) => {
      if (menu.children && menu.children.length) menu.children.forEach((child) => add(child, menu.title));
      else add(menu);
    });
    // Reachable from the profile card rather than the menu, but worth finding.
    add({ title: 'My Profile', icon: 'bx bx-user-circle', routePath: '16' });
    return out;
  })();
  const canOpenGlobalSettings = canOpenRoute('19');
  // Phone-system records already in the startup data. Queues, IVRs, DIDs,
  // gateways and conferences are managed on Call Flow; groups on Extensions.
  const searchRecords = (() => {
    const out = [];
    if (canOpenRoute('12')) {
      (queues || []).forEach((q) => q && out.push({
        id: `queue-${q.queue_extension ?? q.queue_uuid ?? q.queue_name}`, type: t('Queue'), title: q.queue_name || String(q.queue_extension || ''),
        detail: q.queue_extension != null ? String(q.queue_extension) : undefined, icon: 'bx bx-list-ul', route: '12', keywords: 'call queue acd',
      }));
      (ivrs || []).forEach((m) => m && out.push({
        id: `ivr-${m.ivr_menu_extension ?? m.ivr_menu_uuid ?? m.ivr_menu_name}`, type: t('IVR'), title: m.ivr_menu_name || String(m.ivr_menu_extension || ''),
        detail: m.ivr_menu_extension != null ? String(m.ivr_menu_extension) : undefined, icon: 'bx bx-sitemap', route: '12', keywords: 'ivr menu auto attendant',
      }));
      (dids || []).forEach((d) => {
        const number = d && (d.did_number || d.did);
        if (!number) return;
        out.push({
          id: `did-${number}`, type: t('DID'), title: String(number),
          detail: d.destination_number ? `${t('routes to')} ${d.destination_number}` : undefined, icon: 'bx bx-phone-incoming', route: '12', keywords: 'did number inbound phone number',
        });
      });
      (gateways || []).forEach((g) => {
        const name = g && (g.gateway || g.name);
        if (!name) return;
        out.push({ id: `gateway-${name}`, type: t('Gateway'), title: String(name), icon: 'bx bx-transfer-alt', route: '12', keywords: 'gateway trunk sip trunk provider carrier' });
      });
      (conferences || []).forEach((cf) => cf && out.push({
        id: `conf-${cf.conference_center_extension ?? cf.conference_center_name}`, type: t('Conference'), title: cf.conference_center_name || String(cf.conference_center_extension || ''),
        detail: cf.conference_center_extension != null ? String(cf.conference_center_extension) : undefined, icon: 'bx bx-conversation', route: '12', keywords: 'conference bridge meeting room',
      }));
    }
    if (canOpenRoute('3')) {
      (viewTeams || []).forEach((g) => g && g.group_name && out.push({
        id: `group-${g.group_name}`, type: t('Group'), title: g.group_name,
        detail: Array.isArray(g.extensions) ? `${g.extensions.length} ${t('members')}` : undefined, icon: 'bx bx-group', route: '3', tab: 'teams', keywords: 'group team ring group',
      }));
    }
    return out;
  })();
  const navigateFromSearch = (route, tab) => {
    setActivePage(route);
    if (route === '3') setExtensionsTabRequest({ tab: tab || 'extensions', nonce: Date.now() });
  };
  // Same licence gate GlobalSettings applies to SSL / Storage / Time Machine
  // / Updates / Network / the whole Troubleshooting section; `ownerOnly` is
  // the separate permissionMode===7 gate SMS Playground needs (see
  // GLOBAL_SETTING_SEARCH_ITEMS's own comment for gsetting.dart line refs).
  const searchSettings = GLOBAL_SETTING_SEARCH_ITEMS.filter((item) =>
    (canOpenGlobalSettings || item.everyone)
    && (!item.gated || singleInstance || multiTenantLicenseOwner)
    && (!item.ownerOnly || parseInt(permissionMode) === 7)
    // `supportOnly` is owner OR a RingQ support extension -- neither of the
    // two flags above expresses it, and offering a card whose modal then
    // refuses to draw would be a dead search result.
    && (!item.supportOnly || canManageSupportAccess(permissionMode, userSession?.extension))
  );
  const searchPeople = viewExtensions
    .filter((ext) => ext && ext.extension)
    .map((ext) => {
      const name = `${ext.firstname || ''} ${ext.lastname || ''}`.trim() || String(ext.extension);
      const presenceStatus = presenceMap[ext.extension]?.status ?? ext.status;
      return { ext: String(ext.extension), name, status: String(presenceStatus) === '0' ? 'green' : undefined };
    });
  const openSettingFromSearch = (title) => {
    setActivePage('19');
    setGlobalSettingRequest({ title, nonce: Date.now() });
  };
  const callFromSearch = (number, name) => {
    sipService.makeCall(number, name);
    setIsDialerOpen(true);
  };


  const renderChatElement = () => (
    <Chat
      userSession={userSession}
      dashboardData={dashboardData}
      permissionMode={permissionMode}
      extensions={extensions}
      agentuuids={agentuuids}
      wallQueueAssignments={wallQueueAssignments}
      queues={queues}
      queues2={queues2}
      callcenterFacebookChats={callcenterFacebookChats}
      callcenterWhatsappChats={callcenterWhatsappChats}
      callcenterWebChats={callcenterWebChats}
      callcenterLineChats={callcenterLineChats}
      callcenterTelegramChats={callcenterTelegramChats}
      callcenterTelnyxChats={callcenterTelnyxChats}
      callcenterTwilioChats={callcenterTwilioChats}
    />
  );

  const renderPageContent = () => {
    switch (activePage) {
      case '0':
        // Render the main dashboard row content (will define as a helper or wrapper)
        return null;
      case '24':
      case '1':
        return (
          <TeamDirectory
            extensions={viewExtensions}
            favorites={viewFavorites}
            teams={viewTeams}
            ownExtension={userSession.extension}
            onToggleFavorite={toggleFavorite}
            onCall={(ext) => {
              const directoryMatch = directoryContacts.find((c) => c.ext === String(ext));
              sipService.makeCall(ext, directoryMatch?.name);
              setIsDialerOpen(true);
            }}
            onCallExtensions={onCallExtensions}
            onCallInfo={onCallInfo}
            registeredExtensions={deviceFeedAvailable ? wallboardRegisteredExtensions : undefined}
            devicePresence={devicePresence}
            showCallStatus={tdPermissions.callStatus}
            showInCallNumber={tdPermissions.inCallNumber}
            activeLanguage={activeLanguage}
          />
        );
      case '3':
        return (
          <ExtensionsPage
            extensions={viewExtensions}
            teams={viewTeams}
            showingCachedData={usingCachedDirectory}
            tabRequest={extensionsTabRequest}
            dids={dids}
            conferences={conferences}
            ivrs={ivrs}
            queues={queues}
            auxcodes={auxcodes}
            autoProvisions={autoProvisions}
            timezoneProvisions={timezoneProvisions}
            registeredDevices={devices}
            onlineExtensions={viewOnlineExtensions}
            deviceFeedAvailable={deviceFeedAvailable}
            onDataChanged={fetchDashboardData}
            userSession={userSession}
            onSessionUpdate={handleProfileSessionUpdate}
            activeLanguage={activeLanguage}
            permissionMode={permissionMode}
            result2={result2}
          />
        );
      case '2':
        return <Connections extensions={viewExtensions} initialOnlineExtensions={viewOnlineExtensions} activeLanguage={activeLanguage} />;
      case '16':
        return (
          <MyProfilePage
            userSession={userSession}
            extensions={extensions}
            dids={dids}
            teams={teams}
            conferences={conferences}
            ivrs={ivrs}
            queues={queues}
            auxcodes={auxcodes}
            autoProvisions={autoProvisions}
            timezoneProvisions={timezoneProvisions}
            registeredDevices={devices}
            onlineExtensions={viewOnlineExtensions}
            deviceFeedAvailable={deviceFeedAvailable}
            permissionMode={permissionMode}
            activeProfileColor={activeProfileColor}
            activeProfileStatus={activeProfileStatus}
            appEnabled={viewAppEnabled}
            webappEnabled={viewWebappEnabled}
            callcontrolEnabled={viewCallcontrolEnabled}
            dataLoaded={profileDataLoaded}
            cachedMyDevices={cachedDirectory?.myDevices ?? null}
            cachedMyDids={cachedDirectory?.myDids ?? null}
            activeLanguage={activeLanguage}
            onSessionUpdate={handleProfileSessionUpdate}
            onDataChanged={fetchDashboardData}
            onDeviceChanged={handleDeviceChanged}
          />
        );
      case '23':
        return <UserRoles extensions={viewExtensions} subdomain={userSession.subdomain} activeLanguage={activeLanguage} />
      case '4':
        return <Voicemails permissionMode={permissionMode} showAITranscribeToken={Boolean(dashboardData?.showAITranscribeToken)} activeLanguage={activeLanguage} />;
      // return renderDummyPage("Voice Mails", "Central inbox for audio recordings, voicemail transcripts, and routing notifications.");
      case '5':
        return <Contacts permissionMode={permissionMode} activeLanguage={activeLanguage} />;
      // return renderDummyPage("Contacts Manager", "Internal extension directories, external CRM sync details, and dialing presets.");
      case '21':
        return renderDummyPage("Campaigns", "Configure outbound dialer lists, broadcast rules, agent assignments, and schedules.");
      case '8':
        return renderDummyPage("Broadcast Contacts", "Manage recipient list lists, import contact logs, and check opt-out rules.");
      case '6':
        return (
          <AdvancedWallboard
            agents5={agents5}
            queueExtToName={queueExtToName}
            queues2={queues2}
            wallAuxStatuses={wallAuxStatuses}
            wallStatus={wallStatus}
            registeredExtensions={wallboardRegisteredExtensions}
            supervisorMode={supervisorMode}
            sipCallInfo={sipCallInfo}
            triggerSupervisorAction={triggerSupervisorAction}
            auxcodes={auxcodes}
            wallQueueAssignments={wallQueueAssignments}
            onUpdateAuxcodeStatusForQueue={handleUpdateAuxcodeStatusForQueue}
            onRequestQueueLogin={setQueueLoginConfirmTarget}
            activeLanguage={activeLanguage}
            accountKey={`${userSession?.subdomain || userSession?.domain || ''}:${userSession?.extension || ''}`}
          />
        );
      case '22':
        // [chat-keep-open] Chat is rendered outside the page wrapper (renderChatElement)
        return null;
      case '9':
        return <SMS />;
      case '7':
        return renderCallStatusPage();
      case '13':
        return renderDummyPage("System Reports", "Interactive call cost tables, hourly usage graphs, AUX status reports, and export logs.");
      case '12':
        const API_BASE_CF = getApiBaseUrl();
        return (
          <CallFlowBuilder
            dids={dids}
            setDids={setDids}
            ivrs={ivrs}
            setIvrs={setIvrs}
            queues={queues}
            setQueues={setQueues}
            queues2={queues2}
            setQueues2={setQueues2}
            queueConfig={queueConfig}
            setQueueConfig={setQueueConfig}
            queueManagers={queueManagers}
            queueManagers2={queueManagers2}
            setQueueManagers2={setQueueManagers2}
            scripts={scripts}
            setScripts={setScripts}
            callcenterRinqTalkModes={callcenterRinqTalkModes}
            setCallcenterRinqTalkModes={setCallcenterRinqTalkModes}
            timeschedules={timeschedules}
            setTimeschedules={setTimeschedules}
            conferences={conferences}
            setConferences={setConferences}
            facebookSettings={facebookSettings}
            whatsappSettings={whatsappSettings}
            telegramSettings={telegramSettings}
            lineSettings={lineSettings}
            webChatSettings={webChatSettings}
            telnyxSettings={telnyxSettings}
            twilioSettings={twilioSettings}
            callcenterFacebookChats={callcenterFacebookChats}
            setCallcenterFacebookChats={setCallcenterFacebookChats}
            callcenterWhatsappChats={callcenterWhatsappChats}
            setCallcenterWhatsappChats={setCallcenterWhatsappChats}
            callcenterWebChats={callcenterWebChats}
            setCallcenterWebChats={setCallcenterWebChats}
            callcenterLineChats={callcenterLineChats}
            setCallcenterLineChats={setCallcenterLineChats}
            callcenterTelegramChats={callcenterTelegramChats}
            setCallcenterTelegramChats={setCallcenterTelegramChats}
            callcenterTelnyxChats={callcenterTelnyxChats}
            setCallcenterTelnyxChats={setCallcenterTelnyxChats}
            callcenterTwilioChats={callcenterTwilioChats}
            setCallcenterTwilioChats={setCallcenterTwilioChats}
            API_BASE={API_BASE_CF}
            extensions={extensions}
            gateways={gateways}
            fetchDashboardData={fetchDashboardData}
            permissionMode={permissionMode}
            result2={result2}
            userSession={userSession}
            sipProfiles={dashboardData?.sipProfiles || []}
            teams={teams}
            dashboardData={dashboardData}
            onOpenQueueModule={openQueueModule}
            onOpenOthersModule={openOthersModule}
            faxes={faxes}
            onOpenChatSettings={() => openSettingFromSearch('Chat Settings')}
            live={callFlowLive}
          />
        );
      case '12-queue': {
        const API_BASE_Q = getApiBaseUrl();
        return (
          <QueueModule
            queues={queues}
            queues2={queues2}
            setQueues2={setQueues2}
            queues3={queues3}
            queues4={queues4}
            setQueues3={setQueues3}
            setQueues4={setQueues4}
            agents3={agents3}
            queueConfig={queueConfig}
            queueManagers={queueManagers}
            queueManagers2={queueManagers2}
            scripts={scripts}
            callcenterRinqTalkModes={callcenterRinqTalkModes}
            queueDidAssignments={queueDidAssignments}
            dids={dids}
            extensions={extensions}
            ivrs={ivrs}
            teams={teams}
            conferences={conferences}
            recordings={dashboardData?.recordings || []}
            facebookSettings={facebookSettings}
            whatsappSettings={whatsappSettings}
            telegramSettings={telegramSettings}
            lineSettings={lineSettings}
            webChatSettings={webChatSettings}
            telnyxSettings={telnyxSettings}
            twilioSettings={twilioSettings}
            callcenterFacebookChats={callcenterFacebookChats}
            setCallcenterFacebookChats={setCallcenterFacebookChats}
            callcenterWhatsappChats={callcenterWhatsappChats}
            setCallcenterWhatsappChats={setCallcenterWhatsappChats}
            callcenterWebChats={callcenterWebChats}
            setCallcenterWebChats={setCallcenterWebChats}
            callcenterLineChats={callcenterLineChats}
            setCallcenterLineChats={setCallcenterLineChats}
            callcenterTelegramChats={callcenterTelegramChats}
            setCallcenterTelegramChats={setCallcenterTelegramChats}
            callcenterTelnyxChats={callcenterTelnyxChats}
            setCallcenterTelnyxChats={setCallcenterTelnyxChats}
            callcenterTwilioChats={callcenterTwilioChats}
            setCallcenterTwilioChats={setCallcenterTwilioChats}
            API_BASE={API_BASE_Q}
            fetchDashboardData={fetchDashboardData}
            permissionMode={permissionMode}
            userSession={userSession}
            onExit={exitToCallFlow}
          />
        );
      }
      case '12-others': {
        return (
          <OthersModule
            conferences={conferences}
            faxes={faxes}
            dids={dids}
            fetchDashboardData={fetchDashboardData}
            onExit={exitToCallFlow}
          />
        );
      }
      case '19':
        return (
          <GlobalSettings
            openSettingRequest={globalSettingRequest}
            extensions={extensions}
            permissionMode={permissionMode}
            showAITranscribeToken={Boolean(dashboardData?.showAITranscribeToken)}
            queues={queues}
            auxcodes={auxcodes}
            wrapupCodes={dashboardData?.wrapupcodes || []}
            userSession={userSession}
            result2={result2}
            dashboardData={dashboardData}
            fetchDashboardData={fetchDashboardData}
            refreshAITranscribeGate={refreshAITranscribeGate}
            autoProvisions={autoProvisions}
            onLogout={handleLogout}
            ivrs={ivrs}
            teams={teams}
            conferences={conferences}
            timeschedules={timeschedules}
            timezone={timezone}
            activeLanguage={activeLanguage}
            // gsetting.dart:22768 -- LocaleHelper.changeLocale flips the live
            // locale + persists to local storage only, no server call (the
            // personal `language/language` POST in handleSelectLanguage is a
            // separate, header-only action) -- pass the raw setter, not
            // handleSelectLanguage, so the page's own saveGlobalLanguage
            // call (the domain-wide save, gsetting.dart:22769's
            // saveGlobalLocale) isn't duplicated by an extra personal save.
            setActiveLanguage={setActiveLanguage}
            facebookSettings={facebookSettings}
            whatsappSettings={whatsappSettings}
            telegramSettings={telegramSettings}
            lineSettings={lineSettings}
            webChatSettings={webChatSettings}
            telnyxSettings={telnyxSettings}
            twilioSettings={twilioSettings}
            canOpenGrid={canOpenGlobalSettings}
            onExitPage={() => setActivePage(allSearchMenus[0]?.routePath || DEFAULT_PAGE_ID)}
          />
        );
      case '20':
        return (
          <Chameleon
            dashboardData={dashboardData}
            extensions={extensions}
            ivrs={ivrs}
            queues={queues}
            conferences={conferences}
            teams={teams}
            ownExtension={userSession.extension}
            hideCallCenterSwitch={hideCallCenterSwitch}
            setHideCallCenterSwitch={setHideCallCenterSwitch}
            hotelParameters={hotelParameters}
            setHotelParameters={setHotelParameters}
            showDialButton={showDialButton}
            setShowDialButton={setShowDialButton}
            hotelFrontDeskMenuEnabled={hotelFrontDeskMenuEnabled}
            setHotelFrontDeskMenuEnabled={setHotelFrontDeskMenuEnabled}
            customDialerSettings={customDialerSettings}
            setCustomDialerSettings={setCustomDialerSettings}
            activeLanguage={activeLanguage}
          />
        );
      case '28':
        return renderDummyPage(t("Help & Troubleshooting"), t("Watch video tutorials, open troubleshooting tickets, view getting started manuals, and contact developers."));
      case '29':
        return renderAppsPage();
      case '30':
        return <EFax />;
      case '31':
        return (
          <HotelFrontDeskPage
            ivrs={ivrs}
            ownExtension={userSession.extension}
            onOwnGuestNameChange={(firstname, lastname) => handleProfileSessionUpdate({ firstname, lastname })}
          />
        );
      default:
        return renderDummyPage("Page Not Found", "The requested workspace page could not be located.", { inlineDescription: true });
    }
  };

  const renderLoginScreen = () => {
    const activeLogo = whiteLabelLogo || appAsset('images/ringq_blue.png');
    return (
      <div className="login-screen-backdrop" style={{ backgroundImage: `url('${appAsset('images/background2.png')}')` }}>
        <div className="login-card-container">
          <img src={activeLogo} alt="Logo" className="login-logo" />

          <div className="login-tabs-header-bar">
            <button
              className={`login-tab-btn ${loginTab === 0 ? 'active' : ''}`}
              onClick={() => { setLoginTab(0); setAuthError(''); setAuthSuccess(''); }}
              disabled={submitting}
            >
              Access Code
            </button>
            <button
              className={`login-tab-btn ${loginTab === 1 ? 'active' : ''}`}
              onClick={() => {
                setLoginTab(1);
                setAuthError('');
                setAuthSuccess('');
                setQrCodeData(`ringq-sso-${Math.random().toString(36).substring(7)}`);
              }}
              disabled={submitting}
            >
              SSO QR
            </button>
            <button
              className={`login-tab-btn ${loginTab === 2 ? 'active' : ''}`}
              onClick={() => { setLoginTab(2); setAuthError(''); setAuthSuccess(''); }}
              disabled={submitting}
            >
              SSO Code
            </button>
            {webPassword2 && (
              <button
                className={`login-tab-btn ${loginTab === 3 ? 'active' : ''}`}
                onClick={() => { setLoginTab(3); setAuthError(''); setAuthSuccess(''); }}
                disabled={submitting}
              >
                Password
              </button>
            )}
          </div>

          <div className="login-tab-content-panel">
            {authError && <div className="login-alert-toast error">{authError}</div>}
            {authSuccess && <div className="login-alert-toast success">{authSuccess}</div>}

            {loginTab === 0 && (
              <form onSubmit={accessCodeSent ? handleVerifyAccessCode : handleRequestAccessCode} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="login-form-group">
                  <input
                    type="email"
                    placeholder="Email Address"
                    className="login-input-field"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={accessCodeSent || submitting}
                    required
                  />
                  <i className="bx bx-envelope login-input-icon"></i>
                </div>

                {accessCodeSent && (
                  <div className="login-form-group">
                    <input
                      type="password"
                      placeholder="Access Code"
                      className="login-input-field"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      disabled={submitting}
                      required
                    />
                    <i className="bx bx-lock-alt login-input-icon"></i>
                  </div>
                )}

                <button type="submit" className="login-action-btn-blue" disabled={submitting}>
                  {submitting ? 'PROCESSING...' : accessCodeSent ? 'SUBMIT' : 'REQUEST CODE'}
                </button>

                {accessCodeSent && (
                  <button type="button" className="login-resend-link" onClick={handleRequestAccessCode} disabled={submitting}>
                    Resend Code
                  </button>
                )}
              </form>
            )}

            {loginTab === 1 && (
              <div style={{ textAlign: 'center', width: '100%' }}>
                <p style={{ color: '#d8e4ff', fontSize: '14px', margin: '0 0 16px 0' }}>Scan QR to login via mobile app</p>
                <div className="login-qr-wrapper">
                  {qrCodeData ? (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrCodeData)}`}
                      alt="SSO QR Code"
                      className="login-qr-img"
                    />
                  ) : (
                    <i className="bx bx-loader-alt bx-spin" style={{ fontSize: '32px', color: '#2563eb' }}></i>
                  )}
                </div>
              </div>
            )}

            {loginTab === 2 && (
              <form onSubmit={handleSsoCodeLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="login-form-group">
                  <input
                    type="text"
                    placeholder="Email Address"
                    className="login-input-field"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={submitting}
                    required
                  />
                  <i className="bx bx-at login-input-icon"></i>
                </div>

                <button type="submit" className="login-action-btn-blue" disabled={submitting}>
                  {submitting ? 'PROCESSING...' : 'SUBMIT'}
                </button>
              </form>
            )}

            {loginTab === 3 && (
              <form onSubmit={handlePasswordLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="login-form-group">
                  <input
                    type="email"
                    placeholder="Email Address"
                    className="login-input-field"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={submitting}
                    required
                  />
                  <i className="bx bx-envelope login-input-icon"></i>
                </div>

                <div className="login-form-group">
                  <input
                    type="password"
                    placeholder="Password"
                    className="login-input-field"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={submitting}
                    required
                  />
                  <i className="bx bx-lock-alt login-input-icon"></i>
                </div>

                <button type="submit" className="login-action-btn-blue" disabled={submitting}>
                  {submitting ? 'PROCESSING...' : 'SUBMIT'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (authLoading) {
    return <AppLoadingScreen logo={whiteLabelLogo} />;
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        initialWhiteLabelLogo={whiteLabelLogo}
        initialWebPassword2={webPassword2}
        onLoginSuccess={(session) => {
          setUserSession(session);
          localStorage.setItem('session', JSON.stringify(session));
          if (session.permissionMode) {
            setPermissionMode(parseInt(session.permissionMode));
          }
          setIsAuthenticated(true);
        }}
      />
    );
  }

  // Calculate resource usage values
  // const diskPct = serverResources ? parseFloat(serverResources.systemDiskUsagePercentage || 0) : 21;
  const diskPct = serverResources
    ? Math.round(
      parseFloat(viewServerResources.systemDiskUsagePercentage || "0")
    )
    : 21;
  const diskTotal = viewServerResources ? parseFloat(viewServerResources.systemDiskTotalSpace || 0) : 0;
  const diskFree = viewServerResources ? (diskTotal * (100 - diskPct) / 100).toFixed(2) : "62.03";
  // Info-icon tooltip content -- the Dart source passes the literal,
  // untranslated placeholder strings "diskUsage"/"CPU usage" here (checked
  // across every duplicated buildCircularIndicator call site in home.dart),
  // not real copy, so this mirrors Memory's info icon instead: the total
  // capacity figure that complements the "free"/core-count subtitle already
  // shown on the card.
  const diskTotalInfo = `${diskTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GB Disk Total`;

  const memTotal = viewServerResources ? parseFloat(viewServerResources.systemMemTotal || 0) : 0;
  const memUsed = viewServerResources ? parseFloat(viewServerResources.systemMemUsed || 0) : 0;
  const memPct = memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 37;
  const memAvailable = viewServerResources ? parseFloat(viewServerResources.systemMemAvailable || 0) : 0;
  const memFreeStr = viewServerResources ? (memAvailable / 1024).toLocaleString('en-US', { maximumFractionDigits: 2 }) : "2,458.81";
  // Info-icon tooltip content (home.dart:8303's buildCircularIndicator call --
  // the only one of the three resource cards whose info icon carries a real,
  // formatted reading rather than a literal placeholder string).
  const memTotalInfo = `${(memTotal / 1024).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB Memory Total`;

  const cpuPct = viewServerResources ? Math.round(parseFloat(viewServerResources.systemLoadPercentage || 0)) : 38;
  const cpuCores = viewServerResources ? viewServerResources.systemCoreCount : 2;
  // systemLoadSystem (the raw Unix load average -- what home.dart itself
  // gates the CPU card's existence on, systemLoadSystem != null, yet never
  // actually displays) is a genuinely new reading, unlike core count which
  // the subtitle already shows.
  const cpuLoadInfo = viewServerResources && viewServerResources.systemLoadSystem != null
    ? `${parseFloat(viewServerResources.systemLoadSystem).toFixed(2)} System Load Average`
    : `${cpuCores} CPU Cores`;

  // Registration is presence -- live `extensions` only, never the display cache
  // (which doesn't store status2, so it would count everyone as registered).
  const totalExtensions = extensions.length > 0 ? extensions.length : 5;
  const unregisteredExtensions = extensions.length > 0 ? extensions.filter(e => e.status2 === 'Logged Out').length : 1;
  const registeredExtensions = totalExtensions - unregisteredExtensions;

  const formatLicenseDate = (epoch) => {
    if (!epoch) return '2027-03-06 12:36';
    const d = new Date(parseInt(epoch) * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Dashboard (table-first layout): live call counts come from the same
  // activeCalls feed as the table itself (the old System Information
  // "Inbound/Outbound Calls" badges were hardcoded to 0).
  const dashActiveRows = activeCalls.map(mapCallRow);
  const dashCallCounts = {
    total: dashActiveRows.length,
    inbound: dashActiveRows.filter(r => r.direction.toLowerCase().startsWith('in')).length,
    outbound: dashActiveRows.filter(r => r.direction.toLowerCase().startsWith('out')).length,
  };

  // Recent calls card: completed + failed calls, newest first (rows without
  // an epoch keep their payload order at the end).
  const toRecentCall = (row, idx, failed) => {
    const mapped = mapCallRow(row);
    return {
      key: `${failed ? 'f' : 'p'}-${mapped.uuid || idx}`,
      direction: mapped.direction,
      caller: mapped.caller,
      callee: mapped.callee,
      duration: mapped.duration,
      time: mapped.time,
      epoch: Number(row.created_epoch) || 0,
      failed,
    };
  };
  const dashRecentCalls = [
    ...previousCalls.map((row, i) => toRecentCall(row, i, false)),
    ...failedCalls.map((row, i) => toRecentCall(row, i, true)),
  ].sort((a, b) => b.epoch - a.epoch);

  // Only resources that need attention get colour: >=90% critical, >=75% warning.
  const healthLevel = (pct) => (pct >= 90 ? 'crit' : pct >= 75 ? 'warn' : 'ok');
  const dashHealthRows = [
    { key: 'cpu', label: t('CPU'), pct: cpuPct, sub: `${cpuCores} ${t('CPU(s)')}` },
    { key: 'mem', label: t('Memory'), pct: memPct, sub: `${memFreeStr} ${t('MB free')}` },
    { key: 'disk', label: t('Disk'), pct: diskPct, sub: `${diskFree} ${t('GB free')}` },
  ];

  const dashTrunks = (gateways3 || []).map(item => ({ name: Object.keys(item)[0], up: !!Object.values(item)[0] }));
  const dashTrunksUp = dashTrunks.filter(tr => tr.up).length;
  // The rail card shows a few trunks (down ones first, since those need
  // attention); the full list opens in a dialog, like System Information.
  const DASH_TRUNK_PREVIEW = 4;
  const dashTrunksSorted = [...dashTrunks].sort((a, b) => Number(a.up) - Number(b.up));
  const dashTrunksPreview = dashTrunks.length > DASH_TRUNK_PREVIEW
    ? dashTrunksSorted.slice(0, DASH_TRUNK_PREVIEW - 1)
    : dashTrunksSorted;

  // Static license/server details, collapsed by default in the rail. Missing
  // values show an em dash instead of the old made-up placeholder data.
  const dashFqdn = userSession.subdomain || userSession.domain || (result2 ? result2.domain : getApiHost());
  const dashStatus = result2 && result2.status ? result2.status.charAt(0).toUpperCase() + result2.status.slice(1) : '';
  const dashOwner = result2 ? [result2.firstName, result2.lastName].filter(Boolean).join(' ') : '';
  const dashSystemDetails = [
    { label: t('Type:'), value: result2 ? `${result2.type || t('Single Tenant')}${dashStatus ? ` (${dashStatus})` : ''}` : '', extra: result2 && result2.endDate ? `${t('Until')} ${formatLicenseDate(result2.endDate)}` : '' },
    { label: t('Partner:'), value: result2 ? result2.companyName : '' },
    { label: t('License Owner:'), value: dashOwner, extra: result2 ? result2.email : '' },
    { label: t('License Key:'), value: result2 ? result2.licenseKey : '', copy: true, mono: true },
    { label: t('Size:'), value: result2 ? result2.concurrentLicense : '' },
    { label: t('Contact:'), value: result2 ? result2.phoneNumber : '', href: result2 && result2.phoneNumber ? `tel:${result2.phoneNumber}` : '' },
    { label: t('FQDN:'), value: dashFqdn, href: dashFqdn ? `https://${dashFqdn}` : '', copy: true },
    { label: t('Install Type:'), value: (userSession.subdomain || userSession.domain || window.location.hostname || '').split('.').length < 4 ? t('Single') : t('Multi') },
    { label: t('IP:'), value: viewServerResources ? viewServerResources.systemIpAdress : '', copy: true, mono: true },
    { label: t('SIP:'), value: '5060', mono: true },
    { label: t('Media:'), value: '16384-32768', mono: true },
    { label: t('Version:'), value: dashboardData ? dashboardData.version : '', mono: true },
  ];
  const dashSysInfoSummary = dashSystemDetails.filter(item => [t('Type:'), t('FQDN:'), t('Version:')].includes(item.label));

  const renderDashDetailRow = (item) => (
    <div className="dash-details-row" key={item.label}>
      <dt>{item.label.replace(/:$/, '')}</dt>
      <dd>
        {item.node ? item.node : item.value ? (
          item.href ? (
            <a className={`dash-details-value link ${item.mono ? 'mono' : ''}`} href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{item.value}</a>
          ) : (
            <span className={`dash-details-value ${item.mono ? 'mono' : ''}`}>{item.value}</span>
          )
        ) : (
          <span className="dash-details-value muted">—</span>
        )}
        {item.copy && item.value && (
          <button
            type="button"
            className={`dash-copy-btn ${dashCopied === item.label ? 'is-copied' : ''}`}
            title={dashCopied === item.label ? t('Copied') : t('Copy')}
            aria-label={`${t('Copy')} ${item.label}`}
            onClick={() => copyDashValue(item.label, item.value)}
          >
            {dashCopied === item.label ? (
              <>
                <i className="bx bx-check" aria-hidden="true"></i>
                <span className="dash-copied-label" role="status">{t('Copied')}</span>
              </>
            ) : (
              <i className="bx bx-copy" aria-hidden="true"></i>
            )}
          </button>
        )}
        {item.extra && <span className="dash-details-extra">{item.extra}</span>}
      </dd>
    </div>
  );

  // View 2's System Information: the same rows as View 1's dialog, split
  // into three columns so the whole list fits in one short card.
  const pickDashDetails = (labels) => labels
    .map(label => dashSystemDetails.find(item => item.label === label))
    .filter(Boolean);
  const dashV1SysInfoGroups = [
    { key: 'license', title: t('License'), rows: pickDashDetails([t('Type:'), t('Partner:'), t('License Owner:'), t('License Key:'), t('Size:'), t('Contact:')]) },
    { key: 'network', title: t('Network'), rows: pickDashDetails([t('FQDN:'), t('Install Type:'), t('IP:'), t('SIP:'), t('Media:')]) },
    {
      key: 'system',
      title: t('System'),
      rows: [
        ...pickDashDetails([t('Version:')]),
        {
          label: t('System Extensions:'),
          node: (
            <span className="dash-v1-status-ok">
              <span className="dash-status-dot"></span>
              {t('Running')}
            </span>
          ),
        },
        { label: t('Inbound Calls:'), node: <span className="dash-details-value mono dash-v1-count inbound">{dashCallCounts.inbound}</span> },
        { label: t('Outbound Calls:'), node: <span className="dash-details-value mono dash-v1-count outbound">{dashCallCounts.outbound}</span> },
        {
          label: t('Trunks:'),
          node: dashTrunks.length > 0 ? (
            // One line only: extra trunks collapse into a "+N" chip that
            // opens the same Trunks dialog as View 1.
            <DashboardTrunkLine trunks={dashTrunksSorted} onMore={() => setShowDashboardTrunks(true)} t={t} />
          ) : (
            <span className="dash-empty-note">{t('No trunks registered')}</span>
          ),
        },
      ],
    },
  ];

  // Picking a view also saves it as the user's default dashboard.
  // Its own card at the top of each view's right column (View 1: above
  // System Health, View 2: above Extensions), level with the main panel's
  // top edge, so it sits in the same place in both.
  const renderDashboardViewCard = () => (
    <section className="dash-card dash-view-card">
      <span className="dash-view-card-label">{t('Dashboard view')}</span>
      {renderDashboardViewPicker()}
    </section>
  );
  const renderDashboardViewPicker = () => (
    <div className="dash-view-picker">
      <Select
        aria-label={t('Default dashboard view')}
        size="sm"
        selectedKey={dashboardView}
        onSelectionChange={(key) => chooseDashboardView(String(key))}
      >
        <Select.Item id="1">{t('View 1 · Live Calls')}</Select.Item>
        <Select.Item id="2">{t('View 2 · Overview')}</Select.Item>
      </Select>
    </div>
  );

  return (
    <div
      // .theme-slate = the blue-slate theme (see App.css); it drops the
      // classic dark theme's blob background image.
      className={`app-container ${!isDarkMode ? 'light-mode' : ''} ${themeMode === 'slate' ? 'theme-slate' : ''}`}
      style={{ backgroundImage: themeMode === 'slate' ? 'none' : `url(${isDarkMode ? appAsset('images/background2.png') : appAsset('images/background.jpg')})` }}
    >

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo">
          <img
            src={appAsset(isDarkMode ? 'images/ringq_blue.png' : 'images/logo1.png')}
            alt="RingQ Logo"
            className="sidebar-logo-full"
          />
          <img
            src={appAsset('images/favicon.png')}
            alt="RingQ"
            className="sidebar-logo-icon"
          />
        </div>

        <div
          className="sidebar-toggle-btn"
          onClick={() => {
            const collapsing = !isSidebarCollapsed;
            setIsSidebarCollapsed(collapsing);
            // Any open submenu has no room to show once the rail collapses
            // to icons -- close it instantly instead of letting its
            // Framer Motion exit animation race the sidebar's own CSS
            // width transition (that's what was making the bottom section
            // look glitchy while collapsing).
            if (collapsing) {
              setExpandedMenus({});
            }
          }}
        >
          <i className={`bx ${isSidebarCollapsed ? 'bx-chevron-right' : 'bx-chevron-left'}`}></i>
        </div>

        <div className="sidebar-scrollable-menu">
          {isAuthenticated && (
            <div className="sidebar-search">
              <button
                type="button"
                className="sidebar-search-btn"
                onClick={() => setIsSearchOpen(true)}
                aria-label={t('Search')}
                aria-keyshortcuts={isMacPlatform ? 'Meta+K' : 'Control+K'}
                title={isSidebarCollapsed ? `${t('Search')} (${isMacPlatform ? '⌘K' : 'Ctrl+K'})` : undefined}
              >
                <i className="bx bx-search" aria-hidden="true"></i>
                <span className="sidebar-search-label">{t('Search')}</span>
                <kbd className="sidebar-search-kbd">{isMacPlatform ? '⌘K' : 'Ctrl K'}</kbd>
              </button>
            </div>
          )}
          <AppSidebarNav
            className="sidebar-menu"
            menus={getPrimaryMenus()}
            activePage={activePage}
            expandedMenus={expandedMenus}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleMenu={handleToggleSidebarMenu}
            onSelectPage={selectPageFromMenu}
            t={t}
          />

          <AppSidebarNav
            className="sidebar-secondary-menu"
            menus={getSecondaryMenus()}
            activePage={activePage}
            expandedMenus={expandedMenus}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleMenu={handleToggleSidebarMenu}
            onSelectPage={selectPageFromMenu}
            t={t}
          />
        </div>

        <div className="sidebar-fixed-footer">
          <div className="profile-card">
            <div className="profile-avatar-circle" onClick={() => setActivePage('16')} style={{ cursor: 'pointer' }}>
              {headerAvatarUrl ? (
                <img src={headerAvatarUrl} alt="" className="profile-avatar-img" onError={() => setAvatarLoadFailed(true)} />
              ) : (
                (userSession.firstname ? (userSession.firstname[0] + (userSession.lastname ? userSession.lastname[0] : '')).toUpperCase() : 'RT')
              )}
            </div>
            <div className="profile-details">
              <div className="profile-details-name">
                {userSession.firstname ? `${userSession.firstname} ${userSession.lastname || ''}` : 'Rashid Test'}
              </div>
            </div>
            <i className="bx bx-log-out logout-icon" title={t('Logout')} onClick={handleLogout}></i>
          </div>
        </div>
      </aside>

      <AppSearch
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        pages={searchPages}
        settings={searchSettings}
        people={searchPeople}
        records={searchRecords}
        onOpenSetting={openSettingFromSearch}
        onCall={callFromSearch}
        onNavigate={navigateFromSearch}
        t={t}
      />

      {/* Main content pane */}
      <main className="main-content">

        {/* Navigation Bar */}
        <Topbar
          activeLanguage={activeLanguage}
          activeProfileColor={activeProfileColor}
          activeProfileStatus={activeProfileStatus}
          balance={balance}
          canProbeBackground={isAuthenticated && canOpenGlobalSettings}
          companyLimits={companyLimits}
          gatewayStatus={gatewayStatus}
          handleLogout={handleLogout}
          handleOpenDesktopApp={handleOpenDesktopApp}
          handleSelectLanguage={handleSelectLanguage}
          headerAvatarUrl={headerAvatarUrl}
          isDarkMode={isDarkMode}
          isOpeningDesktop={isOpeningDesktop}
          isSidebarCollapsed={isSidebarCollapsed}
          langDropdownRef={langDropdownRef}
          langMenuPosition={langMenuPosition}
          langMenuRef={langMenuRef}
          meetActiveCount={meetActiveCount}
          meetTooltip={meetTooltip}
          openMeetWindow={openMeetWindow}
          permissionMode={permissionMode}
          profileChipRef={profileChipRef}
          profileDropdownRef={profileDropdownRef}
          profileMenuPosition={profileMenuPosition}
          result2={result2}
          dashboardData={dashboardData}
          onOpenPreviousBuilds={() => setShowPreviousBuildsPage(true)}
          onCallFlowDebugStopped={fetchDashboardData}
          updateChip={showUpdateBanner ? {
            state: bannerUpdateFailed ? 'failed' : updateFinalizing ? 'finalizing' : 'available',
            version: bannerVersionShort,
            busy: updateRequesting || updateFinalizing,
            onClick: () => setConfirmUpdateOpen(true),
          } : null}
          onOpenSetting={canOpenGlobalSettings ? openSettingFromSearch : undefined}
          setActivePage={setActivePage}
          setAvatarLoadFailed={setAvatarLoadFailed}
          setFeaturePlaceholder={setFeaturePlaceholder}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          setLangMenuPosition={setLangMenuPosition}
          setProfileMenuPosition={setProfileMenuPosition}
          setShowCalendarModal={setShowCalendarModal}
          setShowClearCacheDialog={setShowClearCacheDialog}
          setShowLangMenu={setShowLangMenu}
          setShowProfileMenu={setShowProfileMenu}
          showLangMenu={showLangMenu}
          showProfileMenu={showProfileMenu}
          sipRegState={sipRegState}
          t={t}
          toggleDarkMode={toggleDarkMode}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          userSession={userSession}
        />

        <MicPermissionPrompt />

        {/* Dashboard Panels */}
        {/* --- AB Modify Start --- */}
        <div className={`workspace ${activePage === '22' ? 'chat-workspace-active' : ''} ${activePage === '0' ? 'dashboard-fit' : ''}`}>
          {/* --- AB Modify End --- */}


          {activePage === '0' ? (
            <div key="dashboard" className="page-transition-wrapper dash-fit-wrapper">
              {/* View 2 = the overview. Its classes keep the old .dash-v1
                  names from when it was View 1. */}
              {dashboardView === '2' ? (
                <div className="dash-v1">
                  <div className="dashboard-row-top">

                    {/* System Status Panel (holds chart + 3 stat cards) */}
                    <div className="status-panel-neon">
                      <div className="status-panel-header">
                        <span className="panel-title-neon">{t('System Status')}</span>
                        <div className="status-range-selector-neon tab-slide tab-slide--pill" role="group" aria-label={t('Time range')} ref={statusRangeRef}>
                          {SYSTEM_STATUS_RANGES.map((range) => (
                            <button
                              key={range.key}
                              type="button"
                              className={`status-range-btn-neon${systemStatusRange === range.key ? ' active' : ''}`}
                              aria-pressed={systemStatusRange === range.key}
                              onClick={() => setSystemStatusRange(range.key)}
                              title={`Show the last ${range.label}`}
                            >
                              {range.label}
                            </button>
                          ))}
                        </div>
                        <div className="chart-legend-neon">
                          {(() => {
                            // Re-evaluated every render, including the periodic
                            // re-render `systemStatusClockTick` triggers every 10s
                            // so a dead socket goes stale even with no new sample.
                            const stale = systemStatusIsStale(systemStatusLastUpdated);
                            return (
                              <span key={systemStatusClockTick} className={`status-live-badge-neon${stale ? ' stale' : ''}`}>
                                <span className="status-live-dot-neon"></span>
                                {stale ? systemStatusRelativeAge(Date.now() - systemStatusLastUpdated) : t('Live')}
                              </span>
                            );
                          })()}
                          <div className="legend-item-neon">
                            <span className="legend-marker cpu"></span>
                            <span>{t('CPU')}</span>
                          </div>
                          <div className="legend-item-neon">
                            <span className="legend-marker mem"></span>
                            <span>{t('Memory')}</span>
                          </div>
                          <div className="legend-item-neon">
                            <span className="legend-marker disk"></span>
                            <span>{t('Disk')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="status-panel-body-neon">

                        <div className="chart-section-neon">
                          <div className="chart-y-axis-labels">
                            <span>100</span>
                            <span>50</span>
                            <span>0</span>
                          </div>

                          <div
                            className="chart-svg-container"
                            ref={chartRef}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={() => setHoveredData(null)}
                          >
                            <svg className="chart-svg-element" viewBox="0 0 720 172" preserveAspectRatio="none">
                              <defs>
                                {/* One faint wash under CPU only -- three overlapping fills muddy
                                      each other; Memory and Disk read fine as lines. */}
                                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" className="chart-grad-cpu" stopOpacity="0.22" />
                                  <stop offset="100%" className="chart-grad-cpu" stopOpacity="0" />
                                </linearGradient>
                              </defs>

                              {/* Reference Dashed Lines */}
                              <line className="chart-gridline" x1="20" y1="30" x2="720" y2="30" />
                              <line className="chart-gridline" x1="20" y1="90" x2="720" y2="90" />
                              <line className="chart-gridline" x1="20" y1="150" x2="720" y2="150" />

                              {/* Area Path (CPU only) */}
                              <path d={getSvgAreaPath('cpu')} fill="url(#cpuGrad)" />

                              {/* Hover crosshair */}
                              {hoveredData && (
                                <line className="chart-crosshair" x1={hoveredData.x} y1="20" x2={hoveredData.x} y2="150" />
                              )}

                              {/* Bezier Line Paths -- non-scaling stroke (App.css) keeps them
                                  2px however wide preserveAspectRatio="none" stretches the SVG. */}
                              <path className="chart-line chart-line-disk" d={getSvgPath('disk')} />
                              <path className="chart-line chart-line-mem" d={getSvgPath('memory')} />
                              <path className="chart-line chart-line-cpu" d={getSvgPath('cpu')} />

                              {/* Tick marks on bottom x-axis -- labels are rendered as an HTML
                                  overlay below (.chart-timeline-ticks) instead of SVG <text>,
                                  since preserveAspectRatio="none" non-uniformly scales this SVG
                                  and squishes glyph widths. */}
                              {systemStatusAxisTicks.map((tick, idx) => (
                                <line key={idx} className="chart-tick" x1={systemStatusSvgX(tick.at)} y1="150" x2={systemStatusSvgX(tick.at)} y2="154" />
                              ))}
                            </svg>

                            {/* Unmeasured stretches (HTML, so the hatching isn't stretched with the SVG) */}
                            {systemStatusGaps.map((gap, idx) => (
                              <div
                                key={`gap-${idx}`}
                                className="chart-gap-band"
                                style={{ left: `${(gap.x1 / 720) * 100}%`, width: `${((gap.x2 - gap.x1) / 720) * 100}%` }}
                              >
                                {/* Label only where the band is wide enough to hold it */}
                                {(gap.x2 - gap.x1) / 720 > 0.07 && <span>{t('No data')}</span>}
                              </div>
                            ))}

                            {/* End-of-line dots + direct labels (HTML, so dots stay round) */}
                            {systemStatusEnds.map((end) => (
                              <React.Fragment key={end.key}>
                                <span
                                  className={`chart-end-dot chart-end-dot-${end.key}${end.key === 'cpu' && systemStatusLive ? ' is-live' : ''}`}
                                  style={{ left: `${(end.x / 720) * 100}%`, top: `${(end.y / 172) * 100}%` }}
                                  aria-hidden="true"
                                />
                                <span
                                  className={`chart-end-label chart-end-label-${end.key}`}
                                  style={{ left: `${(end.x / 720) * 100}%`, top: `${(end.labelY / 172) * 100}%` }}
                                  title={t(end.label)}
                                >
                                  {Math.round(end.value)}%
                                </span>
                              </React.Fragment>
                            ))}

                            {!hasSystemStatusData && (
                              <div className="chart-empty-state-neon">{t('No data yet')}</div>
                            )}

                            {hoveredData && (
                              <div
                                ref={chartTooltipRef}
                                className="chart-tooltip-neon"
                                style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
                              >
                                <div className="tooltip-time-text">{hoveredData.time || t('NOC Live Monitor')}</div>
                                <div className="tooltip-stat-row"><span className="legend-marker cpu"></span>{t('CPU')}<b>{hoveredData.cpu}%</b></div>
                                <div className="tooltip-stat-row"><span className="legend-marker mem"></span>{t('Memory')}<b>{hoveredData.mem}%</b></div>
                                <div className="tooltip-stat-row"><span className="legend-marker disk"></span>{t('Disk')}<b>{hoveredData.disk}%</b></div>
                              </div>
                            )}
                          </div>

                          <div className="chart-timeline-ticks">
                            {systemStatusAxisTicks.map((tick, idx) => (
                              <span key={idx} style={{ left: `${(systemStatusSvgX(tick.at) / 720) * 100}%`, transform: 'translateX(-50%)' }}>
                                {tick.label}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Stacks vertically beside chart */}
                        <div className="stat-cards-column-neon">

                          {/* Disk Usage Card */}
                          <div className="resource-card-neon">
                            <div className="resource-card-left-neon">
                              <div className="progress-ring-container-neon">
                                <svg width="44" height="44" viewBox="0 0 44 44">
                                  <circle cx="22" cy="22" r="19" fill="none" stroke="#122543" strokeWidth="3" />
                                  <circle cx="22" cy="22" r="19" fill="none" stroke="#18A9FF" strokeWidth="3"
                                    strokeDasharray="119.38" strokeDashoffset={119.38 - (119.38 * diskPct) / 100}
                                    transform="rotate(-90 22 22)" strokeLinecap="round" />
                                </svg>
                                <span className="progress-ring-text-neon">{diskPct}%</span>
                              </div>
                              <div className="resource-card-labels">
                                <div className="resource-card-title-neon">{t('Disk Usage')}</div>
                                <div className="resource-card-subtitle-neon">{diskFree} {t('GB free')}</div>
                              </div>
                            </div>
                            <i className="bx bxs-info-circle info-icon-neon" title={diskTotalInfo}></i>
                          </div>

                          {/* Memory Usage Card */}
                          <div className="resource-card-neon">
                            <div className="resource-card-left-neon">
                              <div className="progress-ring-container-neon">
                                <svg width="44" height="44" viewBox="0 0 44 44">
                                  <circle cx="22" cy="22" r="19" fill="none" stroke="#122543" strokeWidth="3" />
                                  <circle cx="22" cy="22" r="19" fill="none" stroke="#18A9FF" strokeWidth="3"
                                    strokeDasharray="119.38" strokeDashoffset={119.38 - (119.38 * memPct) / 100}
                                    transform="rotate(-90 22 22)" strokeLinecap="round" />
                                </svg>
                                <span className="progress-ring-text-neon">{memPct}%</span>
                              </div>
                              <div className="resource-card-labels">
                                <div className="resource-card-title-neon">{t('Memory Usage')}</div>
                                <div className="resource-card-subtitle-neon">{memFreeStr} {t('MB free')}</div>
                              </div>
                            </div>
                            <i className="bx bxs-info-circle info-icon-neon" title={memTotalInfo}></i>
                          </div>

                          {/* CPU Usage Card */}
                          <div className="resource-card-neon">
                            <div className="resource-card-left-neon">
                              <div className="progress-ring-container-neon">
                                <svg width="44" height="44" viewBox="0 0 44 44">
                                  <circle cx="22" cy="22" r="19" fill="none" stroke="#122543" strokeWidth="3" />
                                  <circle cx="22" cy="22" r="19" fill="none" stroke="#18A9FF" strokeWidth="3"
                                    strokeDasharray="119.38" strokeDashoffset={119.38 - (119.38 * cpuPct) / 100}
                                    transform="rotate(-90 22 22)" strokeLinecap="round" />
                                </svg>
                                <span className="progress-ring-text-neon">{cpuPct}%</span>
                              </div>
                              <div className="resource-card-labels">
                                <div className="resource-card-title-neon">{t('CPU Usage')}</div>
                                <div className="resource-card-subtitle-neon">{cpuCores} {t('CPU(s)')}</div>
                              </div>
                            </div>
                            <i className="bx bxs-info-circle info-icon-neon" title={cpuLoadInfo}></i>
                          </div>

                        </div>

                      </div>
                    </div>

                    <div className="dash-v1-side">
                      {renderDashboardViewCard()}

                      {/* Extensions Panel */}
                      <div className="extensions-panel-neon">
                        <span className="panel-title-neon">{t('Extensions')}</span>

                        <div className="extensions-dial-neon">
                          <svg width="150" height="150" viewBox="0 0 150 150">
                            <circle cx="75" cy="75" r="66" fill="none" stroke="#1F2937" strokeWidth="11" />
                            <circle cx="75" cy="75" r="66" fill="none" stroke="#18A9FF" strokeWidth="11"
                              strokeDasharray="414.69" strokeDashoffset={414.69 - (414.69 * registeredExtensions) / totalExtensions}
                              transform="rotate(-90 75 75)" strokeLinecap="square" />
                          </svg>
                          <div className="extensions-dial-center-neon">
                            <span className="extensions-dial-count-neon">{totalExtensions}</span>
                            <span className="extensions-dial-label-neon">{t('Extensions')}</span>
                          </div>
                        </div>

                        <div className="extensions-panel-footer-neon">
                          <div className="extensions-legend-vertical">
                            <div className="extensions-bullet-item">
                              <span className="extensions-bullet-dot blue"></span>
                              <span>{t('Registered')} {registeredExtensions}</span>
                            </div>
                            <div className="extensions-bullet-item">
                              <span className="extensions-bullet-dot gray"></span>
                              <span>{t('Unregistered')} {unregisteredExtensions}</span>
                            </div>
                          </div>

                          {/* <button className="topology-outline-btn" title="Capture">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#18A9FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="2.5" />
                            <circle cx="18" cy="12" r="2.5" />
                            <circle cx="18" cy="19" r="2.5" />
                            <circle cx="6" cy="12" r="2.5" />
                            <path d="M8.5 12h5m0 0V5H15m-1.5 7v7H15" />
                          </svg>
                        </button> */}
                          <button
                            className="topology-outline-btn"
                            title={t('Capture')}
                            onClick={() => setShowDashboardCaptureModal(true)}
                          >
                            <IoIosGitMerge
                              size={18}
                              color="#18A9FF"
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>


                  {/* System Information -- View 1's card and detail rows, in three columns */}
                  <section className="dash-card dash-v1-sysinfo">
                    <div className="dash-card-header">
                      <span className="panel-title-neon">{t('System Information')}</span>
                    </div>
                    <div className="dash-v1-sysinfo-grid">
                      {dashV1SysInfoGroups.map(group => (
                        <div className="dash-v1-sysinfo-group" key={group.key}>
                          <div className="dash-v1-sysinfo-heading">{group.title}</div>
                          <dl className="dash-details-list">
                            {group.rows.map(renderDashDetailRow)}
                          </dl>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Active Calls Table -- same table (columns, row data, hang-up action) as the
                      Call Status page's own Active Calls tab, via the shared renderActiveCallsTable
                      above. Was previously a hardcoded stub with an extra "Outbound Id" column the
                      real table doesn't have, and no data binding at all (always "No calls in
                      progress" regardless of activeCalls). */}
                  {/* Takes the height left under the panels and scrolls internally,
                      so View 2 fits the window like View 1. */}
                  <div className="dash-v1-calls">
                    {renderActiveCallsTable(activeCalls.map(mapCallRow))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Table-first layout: live calls are what the Dashboard is opened for,
                      so they take the main column at full height. Health, extensions,
                      trunks and the (collapsed) license details sit in the narrow rail
                      beside it -- or in a strip above it on narrower screens. */}
                  <div className="dash-layout">

                    <section className="dash-card dash-calls">
                      <div className="dash-card-header">
                        <div className="dash-calls-title">
                          <span className={`dash-live-dot ${dashCallCounts.total > 0 ? 'is-live' : ''}`} aria-hidden="true"></span>
                          <span className="panel-title-neon">{t('Active Calls')}</span>
                        </div>
                        <div className="dash-call-counters">
                          <span className="dash-counter"><strong>{dashCallCounts.total}</strong> {t('Active')}</span>
                          <span className="dash-counter inbound"><strong>{dashCallCounts.inbound}</strong> {t('Inbound')}</span>
                          <span className="dash-counter outbound"><strong>{dashCallCounts.outbound}</strong> {t('Outbound')}</span>
                          <button type="button" className="dash-link-btn" onClick={() => setActivePage('7')}>
                            {t('Call Status')} <i className="bx bx-chevron-right" aria-hidden="true"></i>
                          </button>
                        </div>
                      </div>
                      {/* Same table (columns, row data, hang-up action) as the Call Status
                          page's own Active Calls tab, via the shared renderActiveCallsTable. */}
                      {dashActiveRows.length > 0 ? (
                        renderActiveCallsTable(dashActiveRows)
                      ) : (
                        // Idle state, same pattern as the Chats page's "Pick a
                        // conversation" placeholder; the table returns as soon
                        // as a call starts.
                        <div className="dash-calls-empty">
                          <div className="dash-calls-empty-inner">
                            <span className="dash-calls-empty-icon" aria-hidden="true">
                              <i className="bx bx-phone-call"></i>
                            </span>
                            <h2 className="dash-calls-empty-title">{t('No calls in progress')}</h2>
                            <p className="dash-calls-empty-text">
                              {t('Live calls will show up here the moment they start.')}
                            </p>
                            <button type="button" className="dash-calls-empty-btn" onClick={() => setActivePage('7')}>
                              <i className="bx bx-history" aria-hidden="true"></i>
                              {t('View call history')}
                            </button>
                          </div>
                        </div>
                      )}
                    </section>

                    <aside className="dash-rail">

                      {renderDashboardViewCard()}

                      <section className="dash-card">
                        <div className="dash-card-header">
                          <span className="panel-title-neon">{t('System Health')}</span>
                          <button
                            type="button"
                            className="dash-icon-btn"
                            title={t('Capture')}
                            aria-label={t('Capture')}
                            onClick={() => setShowDashboardCaptureModal(true)}
                          >
                            <IoIosGitMerge size={16} />
                          </button>
                        </div>
                        <div className="dash-health-list">
                          {dashHealthRows.map(row => (
                            <div className={`dash-health-row level-${healthLevel(row.pct)}`} key={row.key}>
                              <div className="dash-health-top">
                                <span className="dash-health-label">{row.label}</span>
                                <span className="dash-health-value">{row.pct}%</span>
                              </div>
                              <div className="dash-meter"><span style={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}></span></div>
                              <div className="dash-health-bottom">
                                <span className="dash-health-sub">{row.sub}</span>
                                <svg className="dash-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
                                  <path d={getSparklinePath(row.key)} />
                                </svg>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="dash-card">
                        <div className="dash-card-header">
                          <span className="panel-title-neon">{t('Extensions')}</span>
                          <span className="dash-card-meta">{totalExtensions} {t('total')}</span>
                        </div>
                        <div className="dash-ext-summary">
                          <strong>{registeredExtensions}</strong>
                          <span>{t('Registered')}</span>
                        </div>
                        <div className="dash-meter">
                          <span style={{ width: `${totalExtensions > 0 ? (registeredExtensions / totalExtensions) * 100 : 0}%` }}></span>
                        </div>
                        <div className={`dash-ext-unreg ${unregisteredExtensions > 0 ? 'has-unreg' : ''}`}>
                          <span className="dash-status-dot"></span>
                          {unregisteredExtensions} {t('Unregistered')}
                        </div>
                      </section>

                      <section className={`dash-card dash-trunks-card ${dashTrunks.length === 0 || dashTrunksUp < dashTrunks.length ? 'dash-card-alert' : ''}`}>
                        <div className="dash-card-header">
                          <div className="dash-card-title-group">
                            <span className="panel-title-neon">{t('Trunks')}</span>
                            {dashTrunks.length > 0 && (
                              <span className="dash-card-meta">{dashTrunksUp}/{dashTrunks.length} {t('up')}</span>
                            )}
                          </div>
                          {dashTrunks.length > 0 && (
                            <button type="button" className="dash-link-btn" onClick={() => setShowDashboardTrunks(true)}>
                              {t('Details')} <i className="bx bx-chevron-right" aria-hidden="true"></i>
                            </button>
                          )}
                        </div>
                        {dashTrunks.length > 0 ? (
                          <div className="dash-trunk-list">
                            {dashTrunksPreview.map((tr, i) => (
                              <span className={`dash-trunk-chip ${tr.up ? 'is-up' : 'is-down'}`} key={`${tr.name}-${i}`} title={tr.up ? t('Registered') : t('Unregistered')}>
                                <span className="dash-status-dot"></span>
                                {tr.name}
                              </span>
                            ))}
                            {dashTrunks.length > dashTrunksPreview.length && (
                              <button type="button" className="dash-trunk-chip dash-trunk-more" onClick={() => setShowDashboardTrunks(true)}>
                                +{dashTrunks.length - dashTrunksPreview.length} {t('more')}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="dash-empty-note">{t('No trunks registered')}</div>
                        )}
                      </section>

                      <section className="dash-card dash-sysinfo-card">
                        <div className="dash-card-header">
                          <span className="panel-title-neon">{t('System Information')}</span>
                          <button type="button" className="dash-link-btn" onClick={() => setShowDashboardSysInfo(true)}>
                            {t('Details')} <i className="bx bx-chevron-right" aria-hidden="true"></i>
                          </button>
                        </div>
                        <dl className="dash-details-list">
                          {dashSysInfoSummary.map(renderDashDetailRow)}
                        </dl>
                      </section>

                      <DashboardRecentCalls
                        calls={dashRecentCalls}
                        failedCount={failedCalls.length}
                        t={t}
                        onOpenCallStatus={() => setActivePage('7')}
                      />

                    </aside>
                  </div>
                </>
              )}

              {showDashboardCaptureModal && (
                // .global-page host so the modal picks up the same scoped
                // Global Settings dialog styles as Troubleshooting -> Capture.
                <div className="global-page gs-modal-host">
                  <CaptureModal onClose={() => setShowDashboardCaptureModal(false)} />
                </div>
              )}

              {showDashboardTrunks && (
                <div className="header-dialog-overlay" onClick={() => setShowDashboardTrunks(false)}>
                  <div
                    className="dash-sysinfo-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('Trunks')}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => { if (e.key === 'Escape') setShowDashboardTrunks(false); }}
                  >
                    <div className="dash-card-header">
                      <div className="dash-card-title-group">
                        <span className="panel-title-neon">{t('Trunks')}</span>
                        <span className="dash-card-meta">{dashTrunksUp}/{dashTrunks.length} {t('up')}</span>
                      </div>
                      <button type="button" className="dash-icon-btn" autoFocus aria-label={t('Close')} onClick={() => setShowDashboardTrunks(false)}>
                        <i className="bx bx-x" aria-hidden="true"></i>
                      </button>
                    </div>
                    <ul className="dash-trunk-rows">
                      {dashTrunksSorted.map((tr, i) => (
                        <li className={`dash-trunk-row ${tr.up ? 'is-up' : 'is-down'}`} key={`${tr.name}-${i}`}>
                          <span className="dash-status-dot"></span>
                          <span className="dash-trunk-row-name">{tr.name}</span>
                          <span className="dash-trunk-row-state">{tr.up ? t('Registered') : t('Unregistered')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {showDashboardSysInfo && (
                <div className="header-dialog-overlay" onClick={() => setShowDashboardSysInfo(false)}>
                  <div
                    className="dash-sysinfo-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('System Information')}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => { if (e.key === 'Escape') setShowDashboardSysInfo(false); }}
                  >
                    <div className="dash-card-header">
                      <span className="panel-title-neon">{t('System Information')}</span>
                      <button type="button" className="dash-icon-btn" autoFocus aria-label={t('Close')} onClick={() => setShowDashboardSysInfo(false)}>
                        <i className="bx bx-x" aria-hidden="true"></i>
                      </button>
                    </div>
                    <dl className="dash-details-list">
                      {dashSystemDetails.map(renderDashDetailRow)}
                    </dl>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* --- AB Modify Start --- */
            <>
              {activePage !== '22' && (
                <div key={`${activePage}:${pageResetKey}`} className="page-transition-wrapper">
                  {renderPageContent()}
                </div>
              )}
              {/* [chat-keep-open] kept mounted once opened, hidden on other pages. chat-wrapper-active
                  sets display: flex !important (Chat.css), which beats the inline display: none,
                  so it is only on while Chat is the open page. */}
              {chatKept && (
                <div
                  key={`chat:${chatAccountKey}`}
                  className={`page-transition-wrapper ${activePage === '22' ? 'chat-wrapper-active' : ''}`}
                  style={activePage === '22' ? undefined : { display: 'none' }}
                  aria-hidden={activePage === '22' ? undefined : true}
                >
                  {renderChatElement()}
                </div>
              )}
            </>
          )}
        </div>


        {updateReadyShown && <UpdateReadyDialog record={updateReady} onClose={closeUpdateReady} />}
        {showPreviousBuildsPage && (
          <PreviousBuildsPage
            onClose={() => setShowPreviousBuildsPage(false)}
            dashboardData={dashboardData}
            result2={result2}
            canUpdate={canUpdateFromBuilds}
            updating={updateRequesting || updateFinalizing}
            onUpdate={() => {
              setShowPreviousBuildsPage(false);
              setConfirmUpdateOpen(true);
            }}
          />
        )}

        {/* Hang-up/ban confirmation -- moved out of renderCallStatusPage's own return so it
            also works for the Dashboard's Active Calls table (confirmHangup/confirmBan set
            the same top-level callActionConfirm state either way; this dialog needs to render
            regardless of which page/branch of the switch above is currently showing). */}
        {callActionConfirm && (
          <div className="header-dialog-overlay" onClick={() => setCallActionConfirm(null)}>
            <div className="header-dialog-card" onClick={(e) => e.stopPropagation()}>
              <div className="header-dialog-title" style={{ color: 'var(--primary-color)' }}>
                {callActionConfirm.type === 'ban' ? 'Ban Extension' : 'End Call'}
              </div>
              <div className="header-dialog-message">{callActionConfirm.message}</div>
              <div className="header-dialog-actions">
                <button className="header-dialog-btn-cancel" onClick={() => setCallActionConfirm(null)}>Cancel</button>
                <button
                  className="header-dialog-btn-ok"
                  onClick={() => {
                    callActionConfirm.onConfirm();
                    setCallActionConfirm(null);
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </main>


      {/* home.dart:18059 -- floatingActionButton: null for multiTenantLicenseOwner
          (widened here to hideMeetAndDialer, see its own declaration). */}
      {!hideMeetAndDialer && (
        <button
          type="button"
          className={`dialer-fab ${isDialerOpen ? 'is-open' : ''}`}
          aria-label={isDialerOpen ? 'Close dialer' : 'Open dialer'}
          aria-expanded={isDialerOpen}
          onClick={() => setIsDialerOpen(!isDialerOpen)}
        >
          <i className="bx bxs-phone dialer-fab-icon dialer-fab-icon-phone" aria-hidden="true"></i>
          <i className="bx bx-x dialer-fab-icon dialer-fab-icon-close" aria-hidden="true"></i>
        </button>
      )}


      {/* Queue Login confirmation -- ported from dialer.dart's per-row
          AwesomeDialog, shown before actually logging into the queue.
          Rendered as a top-level sibling (not nested inside .dialer-overlay,
          which has its own CSS transform: scale(...) and would otherwise
          confine this fixed-position overlay to the small dialer widget
          instead of the full viewport). */}
      {queueLoginConfirmTarget && (
        <div className="queue-login-confirm-overlay" onClick={() => setQueueLoginConfirmTarget(null)}>
          <div
            className="queue-login-confirm-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="queue-login-confirm-title"
            aria-describedby="queue-login-confirm-text"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="queue-login-confirm-icon" aria-hidden="true">
              <i className="bx bx-log-in"></i>
            </div>
            <div className="queue-login-confirm-title" id="queue-login-confirm-title">Queue Login</div>
            <div className="queue-login-confirm-text" id="queue-login-confirm-text">Are you sure you want to login to the queue?</div>
            <div className="queue-login-confirm-actions">
              <button type="button" className="queue-login-confirm-cancel" onClick={() => setQueueLoginConfirmTarget(null)}>Cancel</button>
              <button
                type="button"
                className="queue-login-confirm-submit"
                onClick={() => {
                  if (auxcodes.length > 0) {
                    handleUpdateAuxcodeStatusForQueue(auxcodes[0].auxcode_uuid, auxcodes[0].auxcode_status, queueLoginConfirmTarget.ext, queueLoginConfirmTarget.uuid);
                  }
                  setQueueLoginConfirmTarget(null);
                }}
              >
                Log in
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialer popup */}
      <Dialer
        activeConferenceAddSlot={activeConferenceAddSlot}
        activeProfileColor={activeProfileColor}
        activeProfileColors={activeProfileColors}
        activeProfileStatus={activeProfileStatus}
        activeProfiles={activeProfiles}
        agentuuids={agentuuids}
        agentuuidsLoaded={agentuuidsLoaded}
        auxcodeStatus={auxcodeStatus}
        auxcodes={auxcodes}
        avatarLoadFailed={avatarLoadFailed}
        blfEntries={blfEntries}
        blfValues={blfValues}
        callProfilesLoaded={callProfilesLoaded}
        chameleonMode={chameleonMode}
        conferenceAddNumber={conferenceAddNumber}
        conferenceSearchQuery={conferenceSearchQuery}
        customDialerSettings={customDialerSettings}
        dids={dids}
        directoryContacts={directoryContacts}
        dragY={dragY}
        drawerState={drawerState}
        dtmfInput={dtmfInput}
        favorites={favorites}
        getDrawerTargetY={getDrawerTargetY}
        handleDragEnd={handleDragEnd}
        handleDragMove={handleDragMove}
        handleDragStart={handleDragStart}
        handleHandleTap={handleHandleTap}
        handleUpdateAuxcodeStatus={handleUpdateAuxcodeStatus}
        handleUpdateAuxcodeStatusForQueue={handleUpdateAuxcodeStatusForQueue}
        headerAvatarUrl={headerAvatarUrl}
        hideCallCenterSwitch={hideCallCenterSwitch}
        hotelParameters={hotelParameters}
        innerRingRef={innerRingRef}
        isCurrentCallNumberHidden={isCurrentCallNumberHidden}
        isCurrentCallQueueScriptEnabled={isCurrentCallQueueScriptEnabled}
        isDialerOpen={isDialerOpen}
        isDrawerDragging={isDrawerDragging}
        localRecording={localRecording}
        microphones={microphones}
        missedCallsCount={missedCallsCount}
        outboundCallerId={outboundCallerId}
        setOutboundCallerId={setOutboundCallerId}
        outboundDids={outboundDids}
        outerRingRef={outerRingRef}
        parkedSlots={parkedSlots}
        permissionMode={permissionMode}
        queueCallLandingInfo={queueCallLandingInfo}
        queueExtToName={queueExtToName}
        queueLogIn={queueLogIn}
        queueWallboardCalls={queueWallboardCalls}
        selectedDevices={selectedDevices}
        setActiveConferenceAddSlot={setActiveConferenceAddSlot}
        setAvatarLoadFailed={setAvatarLoadFailed}
        setConferenceAddNumber={setConferenceAddNumber}
        setConferenceSearchQuery={setConferenceSearchQuery}
        setDrawerState={setDrawerState}
        setDtmfInput={setDtmfInput}
        isClearLogsConfirmOpen={isClearLogsConfirmOpen}
        setIsClearLogsConfirmOpen={setIsClearLogsConfirmOpen}
        setIsDialerOpen={setIsDialerOpen}
        setLocalRecording={setLocalRecording}
        setQueueLoginConfirmTarget={setQueueLoginConfirmTarget}
        setShowConferencePanel={setShowConferencePanel}
        setShowDeviceSelector={setShowDeviceSelector}
        setShowInCallKeypad={setShowInCallKeypad}
        setShowTransferDialpad={setShowTransferDialpad}
        setShowTransferPopup={setShowTransferPopup}
        setTransferNumber={setTransferNumber}
        setTransferSearchQuery={setTransferSearchQuery}
        showConferencePanel={showConferencePanel}
        showDeviceSelector={showDeviceSelector}
        showDialButton={showDialButton}
        showInCallKeypad={showInCallKeypad}
        showTransferDialpad={showTransferDialpad}
        showTransferPopup={showTransferPopup}
        sipCallInfo={sipCallInfo}
        sipRegState={sipRegState}
        speakers={speakers}
        supervisor={supervisor}
        supervisorMode={supervisorMode}
        transferNumber={transferNumber}
        transferSearchQuery={transferSearchQuery}
        triggerSupervisorAction={triggerSupervisorAction}
        userSession={userSession}
        wallAuxStatuses={wallAuxStatuses}
        wallQueueAssignments={wallQueueAssignments}
        walldata={walldata}
        activeProfileSeededRef={activeProfileSeededRef}
        agents5={agents5}
        extensions={extensions}
        isAuthenticated={isAuthenticated}
        onCallExtensions={onCallExtensions}
        presenceMap={presenceMap}
        queues={queues}
        setActiveProfileColor={setActiveProfileColor}
        setActiveProfileStatus={setActiveProfileStatus}
      />

      {/* Need Support tab + drawer */}
      <SupportDrawer
        isDarkMode={isDarkMode}
        isSupportOpen={isSupportOpen}
        isViewingTickets={isViewingTickets}
        handleSupportSubmit={handleSupportSubmit}
        instanceHost={userSession.subdomain || userSession.domain || getApiHost()}
        replyText={replyText}
        reportDate={reportDate}
        reportTime={reportTime}
        selectedIssues={selectedIssues}
        selectedTicketId={selectedTicketId}
        setIsSupportOpen={setIsSupportOpen}
        setIsViewingTickets={setIsViewingTickets}
        setReplyText={setReplyText}
        setReportDate={setReportDate}
        setReportTime={setReportTime}
        setSelectedIssues={setSelectedIssues}
        setSelectedTicketId={setSelectedTicketId}
        setSupportAccordion={setSupportAccordion}
        setTicketSearch={setTicketSearch}
        setTicketsTab={setTicketsTab}
        supportAccordion={supportAccordion}
        supportTickets={supportTickets}
        ticketSearch={ticketSearch}
        ticketsTab={ticketsTab}
        userSession={userSession}
      />

      {/* Help -> Video Guides */}
      {isVideoTutorialModalOpen && (
        <VideoGuidesModal onClose={() => setIsVideoTutorialModalOpen(false)} />
      )}

      {/* Update confirmation with email OTP (Flutter: runVerifiedUpdate, verified_actions.dart). */}
      {confirmUpdateOpen && (
        <ActionOtpDialog
          title="Update"
          subtitle="Confirm it is you before this server installs an update."
          summary={
            bannerVersionShort
              ? `This will update this server to version ${bannerVersionShort}. Services restart and calls in progress can drop.`
              : 'This will update this server to the latest version. Services restart and calls in progress can drop.'
          }
          verifyLabel="Verify and update"
          dismissLabel="Cancel"
          boundTo="this update"
          manualSend
          resumeKey="server-update"
          send={sendUpdateOtpForBanner}
          verify={verifyUpdateOtp}
          onClose={handleUpdateDialogClose}
        />
      )}

      {/* Clear Cache confirm dialog -- home.dart:4735-4865 (topSlide AlertDialog,
          red title, grey Cancel / blue OK). */}
      {showClearCacheDialog && (
        <div className="header-dialog-overlay" onClick={() => setShowClearCacheDialog(false)}>
          <div className="header-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="header-dialog-title">Clear Cache</div>
            <div className="header-dialog-message">
              This will clear the application cache and reload the page. Continue?
            </div>
            {clearCacheError && <div className="header-dialog-message" style={{ color: '#ef4444' }}>{clearCacheError}</div>}
            <div className="header-dialog-actions">
              <button className="header-dialog-btn-cancel" onClick={() => setShowClearCacheDialog(false)}>Cancel</button>
              <button className="header-dialog-btn-ok" onClick={handleConfirmClearCache}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop App download fallback -- home.dart:4094-4132. */}
      {showDesktopDownloadDialog && (
        <div className="header-dialog-overlay" onClick={() => setShowDesktopDownloadDialog(false)}>
          <div className="header-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="header-dialog-title" style={{ color: 'var(--primary-color)' }}>RingQ Desktop App</div>
            <div className="header-dialog-message">
              The desktop app didn't open automatically.<br />Download and install it to continue.
            </div>
            <div className="header-dialog-actions" style={{ flexDirection: 'column' }}>
              <button className="header-dialog-btn-ok" onClick={handleDownloadWindows}>Download for Windows</button>
              <button className="header-dialog-btn-ok" onClick={() => { window.open('https://apps.apple.com/us/app/ringq-desktop/id6761712376?mt=12', '_blank', 'noopener,noreferrer'); setShowDesktopDownloadDialog(false); }}>Download for macOS</button>
              <button className="header-dialog-btn-cancel" onClick={() => setShowDesktopDownloadDialog(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Shared placeholder shell for header features whose full backend is a
          separate follow-up pass -- see MIGRATION_PLAN.md. */}
      {featurePlaceholder && (
        <div className="header-placeholder-modal-overlay" onClick={() => setFeaturePlaceholder(null)}>
          <div className="header-placeholder-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="header-placeholder-modal-header">
              <h3>{featurePlaceholder.title}</h3>
              <button className="header-placeholder-modal-close" onClick={() => setFeaturePlaceholder(null)}>×</button>
            </div>
            <div className="header-placeholder-modal-body">{featurePlaceholder.message}</div>
          </div>
        </div>
      )}

      {showCalendarModal && (
        <CalendarModal userSession={userSession} meetSession={meetSession} onClose={() => setShowCalendarModal(false)} />
      )}

      {meetWindowOpen && (
        <ResizableMeetWindow
          geometry={meetGeometryRef.current}
          onGeometryChange={(g) => { meetGeometryRef.current = g; }}
          minimized={meetWindowMinimized}
          title="Meet"
          subtitle="Start a video meeting or join one with a link."
          connectionState={meetWindowState.connectionState}
          timerOrigin={meetWindowState.timerOrigin}
          onMinimize={() => setMeetWindowMinimized(true)}
          onRestore={() => setMeetWindowMinimized(false)}
          onClose={closeMeetWindow}
        >
          <LobbyScreen
            session={meetSession}
            launchRequest={meetLaunchRequest}
            onLaunchRequestHandled={handleMeetLaunchHandled}
            onWindowStateChange={setMeetWindowState}
          />
        </ResizableMeetWindow>
      )}


      <QueueCallLandingModal
        visible={showQueueCallLandingModal}
        info={queueCallLandingInfo}
        onClose={() => setShowQueueCallLandingModal(false)}
      />
      <RingToastContainer containerId="call-landing" position="top-right" />
      <QontakCallBridge />

    </div>
  );
}
