import emailjs from '@emailjs/browser';
import html2canvas from 'html2canvas';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  findReservationsByGuestLogin,
  findTrashedByGuestLogin,
  moveToTrash,
  purgeExpiredTrash,
  restoreFromTrash,
  subscribeReservationsByGuestLogin,
  subscribeTrashedByGuestLogin,
  updateReservation,
} from '../../data/reservationsRepo';
import { DISCIPLINES, HOUR_OPTIONS, STORAGE_KEYS } from '../../domain/defaults';
import { flattenGuestRows, rowKey } from '../../domain/listModel';
import { createTranslator } from '../../i18n/t';
import {
  BRAND_ASSETS,
  openWhatsApp,
  whatsappHref,
} from '../../components/BrandLockup';
import SiteBrandFooter from '../../components/SiteBrandFooter';
import RollingBanner from '../../components/RollingBanner';
import { useToast } from '../../ui/ToastContext';
import SchedulerTab from '../admin/tabs/SchedulerTab';
import GuestTopBar from './GuestTopBar';
import MyGuestRowCard from './MyGuestRowCard';
import MyQuoteCapture from './MyQuoteCapture';
import MyTrashPanel from './MyTrashPanel';
import { uploadMailQuotePng } from '../../data/mailQuoteStorage';
import {
  buildProfessionalReservationEmail,
  toEmailJsImageParams,
  toEmailJsParams,
} from '../../lib/emailTemplates';
import { withTimeout } from '../../lib/withTimeout';
import {
  buildQuoteFileName,
  estimateEditPenalty,
  getReservationDeleteBlock,
  matchesDiverSearch,
  repriceReservation,
  reservationHasAppliedDiscount,
  sortReservations,
} from './myReservationUtils';

function loadRememberedMyLogin() {
  const remember = localStorage.getItem(STORAGE_KEYS.myRemember) === '1';
  return {
    remember,
    email: remember ? localStorage.getItem(STORAGE_KEYS.myEmail) || '' : '',
    pin: remember ? localStorage.getItem(STORAGE_KEYS.myPin) || '' : '',
  };
}

function persistMyLogin({ remember, email, pin }) {
  if (remember) {
    localStorage.setItem(STORAGE_KEYS.myRemember, '1');
    localStorage.setItem(STORAGE_KEYS.myEmail, (email || '').trim());
    localStorage.setItem(STORAGE_KEYS.myPin, String(pin || ''));
  } else {
    localStorage.removeItem(STORAGE_KEYS.myRemember);
    localStorage.removeItem(STORAGE_KEYS.myEmail);
    localStorage.removeItem(STORAGE_KEYS.myPin);
  }
}

function guestKey(row) {
  return rowKey(row);
}

function findGuestInRes(res, roomIdx, guestIdx) {
  return res?.roomsData?.[roomIdx]?.guests?.[guestIdx] || null;
}

export default function MyReservations({ settings }) {
  const toast = useToast();
  const quoteRef = useRef(null);
  const autoLookupDone = useRef(false);
  const remembered = useMemo(() => loadRememberedMyLogin(), []);
  const [lang, setLang] = useState(
    () => localStorage.getItem('guest_lang') || 'KO',
  );
  const t = useMemo(() => createTranslator(lang), [lang]);
  const [email, setEmail] = useState(remembered.email);
  const [pin, setPin] = useState(remembered.pin);
  const [rememberMe, setRememberMe] = useState(remembered.remember);
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('submittedDesc');
  const [savingId, setSavingId] = useState('');
  const [quoteTarget, setQuoteTarget] = useState(null);
  const [quoteDiscount, setQuoteDiscount] = useState(true);
  /** 'quote' = 견적서 preview · 'mail' = 승인메일 preview (same sheet) */
  const [quoteMode, setQuoteMode] = useState('quote');
  const [quotePreviewOpen, setQuotePreviewOpen] = useState(false);
  const [quoteSaving, setQuoteSaving] = useState(false);
  const [quoteMailing, setQuoteMailing] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashed, setTrashed] = useState([]);
  const [restoringId, setRestoringId] = useState('');
  const [editingKey, setEditingKey] = useState('');
  const [editBaseline, setEditBaseline] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [infoModal, setInfoModal] = useState(null);
  const [transportModal, setTransportModal] = useState(null);
  const [penaltyModal, setPenaltyModal] = useState(null);
  const [selectedResIds, setSelectedResIds] = useState(() => new Set());
  const [deleteBlockedModal, setDeleteBlockedModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const trainingTypes = (settings?.trainingTypesConfig || []).filter(
    (x) => x.isActive !== false,
  );
  const roomTypes = (settings?.roomTypesConfig || []).filter(
    (x) => x.isActive !== false,
  );
  const paymentAccounts = (settings?.accountsConfig || []).filter(
    (a) => a.isActive !== false,
  );

  useEffect(() => {
    const key = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
    if (key) emailjs.init(key);
  }, []);

  /** Keep My list in sync with admin trash/delete (active reservations only). */
  useEffect(() => {
    if (!authed || !email.trim() || !/^\d{4}$/.test(pin)) return undefined;
    const unsub = subscribeReservationsByGuestLogin(
      email,
      pin,
      (list) => {
        setRows(list);
        setSelectedResIds((prev) => {
          const ids = new Set(list.map((r) => r.id));
          const next = new Set([...prev].filter((id) => ids.has(id)));
          return next.size === prev.size ? prev : next;
        });
      },
      (err) => {
        toast.error(err?.message || t('동기화 실패', 'Sync failed'));
      },
    );
    return () => unsub();
  }, [authed, email, pin, t, toast]);

  /** Guest trash (own deleted bookings only). */
  useEffect(() => {
    if (!authed || !email.trim() || !/^\d{4}$/.test(pin)) {
      setTrashed([]);
      return undefined;
    }
    const unsub = subscribeTrashedByGuestLogin(
      email,
      pin,
      setTrashed,
      (err) => {
        toast.error(err?.message || t('휴지통 동기화 실패', 'Trash sync failed'));
      },
    );
    return () => unsub();
  }, [authed, email, pin, t, toast]);

  const filtered = useMemo(() => {
    const list = rows.filter((r) => matchesDiverSearch(r, search));
    return sortReservations(list, sortBy);
  }, [rows, search, sortBy]);

  const guestRows = useMemo(
    () => flattenGuestRows(filtered),
    [filtered],
  );

  const quoteProcessed = useMemo(() => {
    if (!quoteTarget) return null;
    return repriceReservation(quoteTarget, settings, {
      withDiscount: quoteDiscount,
    });
  }, [quoteTarget, quoteDiscount, settings]);

  const lookup = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast.warn(t('이메일을 입력하세요.', 'Enter a valid email.'));
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      toast.warn(t('4자리 PIN을 입력하세요.', 'Enter 4-digit PIN.'));
      return;
    }
    setBusy(true);
    try {
      const [found, trashFound] = await Promise.all([
        findReservationsByGuestLogin(email, pin),
        findTrashedByGuestLogin(email, pin),
      ]);
      // Enter My even with zero active bookings (trash-only or empty).
      setRows(found);
      setAuthed(true);
      setSelectedResIds(new Set());
      persistMyLogin({ remember: rememberMe, email, pin });
      purgeExpiredTrash(30).catch(() => {});
      if (found.length) {
        toast.success(
          t(
            `예약 ${found.length}건을 불러왔습니다.`,
            `Loaded ${found.length} booking(s).`,
          ),
        );
      } else if (trashFound.length) {
        toast.success(
          t(
            `활성 예약은 없습니다. 휴지통 ${trashFound.length}건을 확인할 수 있습니다.`,
            `No active bookings. ${trashFound.length} item(s) in trash.`,
          ),
        );
      } else {
        toast.success(
          t(
            '나의 예약 조회에 입장했습니다. (조회된 예약 없음)',
            'Entered My Reservations. (No bookings found)',
          ),
        );
      }
    } catch (err) {
      toast.error(err?.message || t('조회 실패', 'Lookup failed'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (autoLookupDone.current) return;
    if (
      !remembered.remember ||
      !remembered.email ||
      !/^\d{4}$/.test(remembered.pin)
    ) {
      return;
    }
    autoLookupDone.current = true;
    lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot restore
  }, []);

  const focusReservation = (resId) => {
    if (!resId) return;
    setScheduleOpen(false);
    const first = guestRows.find((g) => g.resId === resId);
    const id = first
      ? `my-guest-${first.resId}_r${first.roomIdx}_g${first.guestIdx}`
      : `my-guest-${resId}`;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const logoutMy = () => {
    setAuthed(false);
    setRows([]);
    setSearch('');
    setScheduleOpen(false);
    setTrashOpen(false);
    setTrashed([]);
    setEditingKey('');
    setEditBaseline(null);
    setSelectedResIds(new Set());
    if (!rememberMe) {
      setPin('');
      setEmail('');
      persistMyLogin({ remember: false, email: '', pin: '' });
    }
  };

  const toggleSelectRes = (resId) => {
    setSelectedResIds((prev) => {
      const next = new Set(prev);
      if (next.has(resId)) next.delete(resId);
      else next.add(resId);
      return next;
    });
  };

  const openDeleteBlocked = (block) => {
    setDeleteBlockedModal({
      reasons: lang === 'EN' ? block.reasonsEN : block.reasonsKO,
    });
  };

  const trashReservations = async (resList) => {
    if (!resList.length) return;
    setDeleting(true);
    try {
      const allowed = [];
      const blocked = [];
      resList.forEach((res) => {
        const block = getReservationDeleteBlock(res);
        if (block.blocked) blocked.push({ res, block });
        else allowed.push(res);
      });

      if (!allowed.length) {
        openDeleteBlocked(
          blocked[0]?.block || {
            reasonsKO: ['삭제할 수 없습니다.'],
            reasonsEN: ['Cannot delete.'],
          },
        );
        return;
      }

      const blockedNote = blocked.length
        ? t(
            `\n(삭제 불가 ${blocked.length}건은 제외 — 관리자 문의 필요)`,
            `\n(${blocked.length} non-deletable excluded — contact admin)`,
          )
        : '';
      if (
        !window.confirm(
          t(
            `선택한 예약 ${allowed.length}건을 삭제(휴지통)할까요?\n휴지통 보관 후 30일이 지나면 자동 폐기됩니다.`,
            `Move ${allowed.length} booking(s) to trash?\nItems are auto-purged after 30 days.`,
          ) + blockedNote,
        )
      ) {
        return;
      }

      for (const res of allowed) {
        await moveToTrash(res);
      }
      const removed = new Set(allowed.map((r) => r.id));
      setRows((prev) => prev.filter((r) => !removed.has(r.id)));
      setSelectedResIds((prev) => {
        const next = new Set(prev);
        removed.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(
        t(
          `${allowed.length}건을 휴지통으로 옮겼습니다.`,
          `Moved ${allowed.length} booking(s) to trash.`,
        ),
      );
    } catch (err) {
      toast.error(err?.message || t('삭제 실패', 'Delete failed'));
    } finally {
      setDeleting(false);
    }
  };

  const deleteOne = (row) => {
    const res = rows.find((r) => r.id === row.resId);
    if (!res) return;
    const block = getReservationDeleteBlock(res);
    if (block.blocked) {
      openDeleteBlocked(block);
      return;
    }
    trashReservations([res]);
  };

  const deleteSelected = () => {
    const list = rows.filter((r) => selectedResIds.has(r.id));
    if (!list.length) {
      toast.warn(t('선택된 예약이 없습니다.', 'No bookings selected.'));
      return;
    }
    trashReservations(list);
  };

  const restoreTrashed = async (item) => {
    if (
      !window.confirm(
        t(
          '이 예약을 복구할까요? 예약 목록에 다시 표시됩니다.',
          'Restore this booking to your active list?',
        ),
      )
    ) {
      return;
    }
    setRestoringId(item.id);
    try {
      await restoreFromTrash(item);
      toast.success(t('예약을 복구했습니다.', 'Booking restored.'));
    } catch (err) {
      toast.error(err?.message || t('복구 실패', 'Restore failed'));
    } finally {
      setRestoringId('');
    }
  };

  const patchRes = (resId, updater) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== resId) return r;
        return typeof updater === 'function' ? updater(r) : { ...r, ...updater };
      }),
    );
  };

  const patchGuest = (resId, roomIdx, guestIdx, field, value) => {
    patchRes(resId, (r) => {
      const rooms = structuredClone(r.roomsData || []);
      const g = { ...(rooms[roomIdx]?.guests?.[guestIdx] || {}) };
      g[field] = value;
      if (field === 'name') {
        g.name = String(value)
          .replace(/[^a-zA-Z\s]/g, '')
          .toUpperCase();
      }
      rooms[roomIdx].guests[guestIdx] = g;
      return { ...r, roomsData: rooms };
    });
  };

  const patchRoomType = (resId, roomIdx, roomType) => {
    patchRes(resId, (r) => {
      const rooms = structuredClone(r.roomsData || []);
      rooms[roomIdx] = { ...rooms[roomIdx], roomType };
      return { ...r, roomsData: rooms };
    });
  };

  const patchTraining = (resId, roomIdx, guestIdx, trId, qty) => {
    patchRes(resId, (r) => {
      const rooms = structuredClone(r.roomsData || []);
      const g = { ...(rooms[roomIdx]?.guests?.[guestIdx] || {}) };
      g.trainingCounts = {
        ...(g.trainingCounts || {}),
        [trId]: Math.max(0, Number(qty) || 0),
      };
      rooms[roomIdx].guests[guestIdx] = g;
      return { ...r, roomsData: rooms };
    });
  };

  const persistRes = async (res, { toastOk = true } = {}) => {
    setSavingId(res.id);
    try {
      const priced = repriceReservation(res, settings, { withDiscount: true });
      const next = {
        ...res,
        roomsData: priced.processedRooms,
        grandTotalKRW: priced.grandTotalKRW,
        grandTotalUSD: priced.grandTotalUSD,
        updatedAt: new Date().toISOString(),
      };
      await updateReservation(res.id, {
        roomsData: next.roomsData,
        grandTotalKRW: next.grandTotalKRW,
        grandTotalUSD: next.grandTotalUSD,
        repName: next.repName,
        updatedAt: next.updatedAt,
      });
      setRows((prev) => prev.map((r) => (r.id === res.id ? next : r)));
      if (toastOk) toast.success(t('저장되었습니다.', 'Saved.'));
      return next;
    } catch (err) {
      toast.error(err?.message || t('저장 실패', 'Save failed'));
      return null;
    } finally {
      setSavingId('');
    }
  };

  const startEdit = (row) => {
    const key = guestKey(row);
    if (editingKey === key) {
      setEditingKey('');
      setEditBaseline(null);
      return;
    }
    const res = rows.find((r) => r.id === row.resId);
    if (!res) return;
    setEditingKey(key);
    setEditBaseline({
      key,
      resId: row.resId,
      roomIdx: row.roomIdx,
      guestIdx: row.guestIdx,
      guest: structuredClone(findGuestInRes(res, row.roomIdx, row.guestIdx)),
      roomsData: structuredClone(res.roomsData),
      submittedAt: res.submittedAt,
    });
  };

  const applySaveWithOptionalPenalty = async (res, roomIdx, guestIdx, penalty) => {
    let nextRes = res;
    if (penalty?.amountKRW > 0) {
      const rooms = structuredClone(res.roomsData || []);
      const g = { ...(rooms[roomIdx]?.guests?.[guestIdx] || {}) };
      const basePenalty = Number(editBaseline?.guest?.penaltyFee) || 0;
      g.penaltyFee = basePenalty + penalty.amountKRW;
      g.penaltyNote =
        (lang === 'EN' ? penalty.reasonsEN?.[0] : penalty.reasonsKO?.[0]) ||
        t('일정 변경 패널티', 'Schedule change penalty');
      rooms[roomIdx].guests[guestIdx] = g;
      nextRes = { ...res, roomsData: rooms };
    }
    const saved = await persistRes(nextRes);
    if (saved) {
      setEditingKey('');
      setEditBaseline(null);
      setPenaltyModal(null);
    }
  };

  const saveEditedGuest = async (row) => {
    const res = rows.find((r) => r.id === row.resId);
    if (!res || !editBaseline) return;

    const draftPriced = repriceReservation(res, settings, {
      withDiscount: true,
    });
    const baselineRes = {
      ...res,
      roomsData: editBaseline.roomsData,
    };
    const basePriced = repriceReservation(baselineRes, settings, {
      withDiscount: true,
    });
    const nextGuest =
      draftPriced.processedRooms?.[row.roomIdx]?.guests?.[row.guestIdx];
    const baseGuest =
      basePriced.processedRooms?.[row.roomIdx]?.guests?.[row.guestIdx];
    const penalty = estimateEditPenalty({
      baselineGuest: baseGuest,
      nextGuest,
      submittedAt: editBaseline.submittedAt || res.submittedAt,
    });

    if (penalty.amountKRW > 0) {
      setPenaltyModal({
        row,
        res,
        penalty,
      });
      return;
    }
    await applySaveWithOptionalPenalty(res, row.roomIdx, row.guestIdx, null);
  };

  const openQuotePreview = (res, withDiscount) => {
    setQuoteMode('quote');
    setQuoteDiscount(withDiscount);
    setQuoteTarget(res);
    setQuotePreviewOpen(true);
  };

  const openApprovalMailPreview = (res) => {
    const to = res.repEmail || res.bookingInstructor || email;
    if (!to || !String(to).includes('@')) {
      toast.warn(t('수신 이메일이 없습니다.', 'No recipient email.'));
      return;
    }
    setQuoteMode('mail');
    setQuoteDiscount(true);
    setQuoteTarget(res);
    setQuotePreviewOpen(true);
  };

  const closeQuotePreview = () => {
    setQuotePreviewOpen(false);
    setQuoteTarget(null);
    setQuoteSaving(false);
    setQuoteMailing(false);
    setQuoteMode('quote');
  };

  const saveQuotePreview = async () => {
    if (!quoteRef.current || !quoteTarget) return;
    setQuoteSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 40));
      const canvas = await html2canvas(quoteRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const prefix = quoteMode === 'mail' ? 'approval_' : '';
      const fileName = `${prefix}${buildQuoteFileName(quoteTarget)}`;
      const dataUrl = canvas.toDataURL('image/png');
      const blob = await (await fetch(dataUrl)).blob();
      if (typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: 'PNG Image',
                accept: { 'image/png': ['.png'] },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast.success(
            quoteMode === 'mail'
              ? t('승인 안내서를 저장했습니다.', 'Approval sheet saved.')
              : t('견적서를 저장했습니다.', 'Quote saved.'),
          );
          return;
        } catch (err) {
          if (err?.name === 'AbortError') return;
        }
      }
      const a = document.createElement('a');
      a.download = fileName;
      a.href = dataUrl;
      a.click();
      toast.success(
        t(
          '저장을 시작했습니다. 저장 위치를 선택해 주세요.',
          'Save started — choose the download location if prompted.',
        ),
      );
    } catch (err) {
      toast.error(err?.message || t('저장 실패', 'Save failed'));
    } finally {
      setQuoteSaving(false);
    }
  };

  const sendQuoteEmail = async () => {
    if (!quoteTarget || !quoteRef.current) return;
    const to =
      quoteTarget.repEmail || quoteTarget.bookingInstructor || email;
    if (!to || !String(to).includes('@')) {
      toast.warn(t('수신 이메일이 없습니다.', 'No recipient email.'));
      return;
    }
    if (
      !window.confirm(
        t(
          `${to} 로 안내서 메일을 발송할까요?`,
          `Send the statement email to ${to}?`,
        ),
      )
    ) {
      return;
    }
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    if (!serviceId || !templateId) {
      toast.error(
        t(
          'EmailJS 설정이 없습니다. (.env)',
          'EmailJS is not configured (.env).',
        ),
      );
      return;
    }

    setQuoteMailing(true);
    try {
      const built = buildProfessionalReservationEmail({
        kind: quoteMode === 'mail' ? 'approval' : 'quote',
        t,
        lang,
        res: quoteTarget,
        settings,
        withDiscount: quoteDiscount,
      });
      const title =
        quoteMode === 'mail'
          ? t('승인 안내서', 'Approval Statement')
          : t('견적서', 'Quotation');

      let imageUrl = '';
      try {
        await new Promise((r) => setTimeout(r, 40));
        const canvas = await withTimeout(
          html2canvas(quoteRef.current, {
            scale: 1.25,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
          }),
          12000,
          'Capture',
        );
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const blob = await (await fetch(dataUrl)).blob();
        const fileName = buildQuoteFileName(quoteTarget).replace(
          /\.png$/i,
          '.jpg',
        );
        // Storage not set up → upload hangs; hard timeout then fall back to text
        imageUrl = await withTimeout(
          uploadMailQuotePng(blob, fileName),
          8000,
          'Upload',
        );
      } catch (capErr) {
        console.warn('quote image capture/upload skipped', capErr);
      }

      if (imageUrl) {
        await withTimeout(
          emailjs.send(
            serviceId,
            templateId,
            toEmailJsImageParams({
              to_email: to,
              to_name: quoteTarget.repName || built.to_name,
              subject: built.subject,
              title: `IDA × DOUBLE K · ${title}`,
              imageUrl,
              contactsNote: `KakaoTalk: ${BRAND_ASSETS.kakaoId} · WhatsApp ${BRAND_ASSETS.whatsappName}: ${BRAND_ASSETS.whatsappDisplay}`,
            }),
          ),
          20000,
          'EmailJS',
        );
        toast.success(
          t(
            '메일을 발송했습니다. 본문 링크를 누르면 이미지가 열립니다.',
            'Email sent. Open the link in the message to view the image.',
          ),
        );
      } else {
        // Reliable fallback: plain text statement (no huge attachment / no Storage)
        const params = toEmailJsParams(built);
        params.to_email = to;
        params.message = [
          `IDA × DOUBLE K · ${title}`,
          '',
          built.text,
          '',
          t(
            '(이미지 링크 발송은 Firebase Storage 설정 후 가능합니다. 화면에서 「저장하기」로 PNG를 받을 수 있습니다.)',
            '(Image-link email needs Firebase Storage. Use Save on screen for a PNG.)',
          ),
        ].join('\n');
        params.invoice_details = params.message;
        params.message_text = params.message;
        await withTimeout(
          emailjs.send(serviceId, templateId, params),
          20000,
          'EmailJS',
        );
        toast.success(
          t(
            '텍스트 안내 메일을 발송했습니다. (이미지 링크는 Storage 설정 후 가능 · 저장하기로 PNG 가능)',
            'Text statement emailed. (Image link needs Storage · use Save for PNG)',
          ),
        );
      }
    } catch (err) {
      console.error('sendQuoteEmail', err);
      toast.error(
        err?.text ||
          err?.message ||
          t('메일 발송 실패', 'Failed to send email'),
      );
    } finally {
      setQuoteMailing(false);
    }
  };

  const openPayFlow = (row) => {
    setPayModal({ step: 'ask', row });
  };

  const paymentGuideText = () => {
    const names = paymentAccounts.map((a) => a.name).filter(Boolean);
    const list = names.length
      ? names.join(', ')
      : 'IDA bank / IDA Wise / IDA 현장 / CASABLUE';
    return t(
      `결제 수단: ${list}\n\n결제 완료 후 관리자에게 연락하여 「결제 완료되었으니 예약 최종 승인」을 받아 주세요.`,
      `Payment methods: ${list}\n\nAfter paying, contact the admin and request final booking approval.`,
    );
  };

  const renderEditForm = (row) => {
    const res = rows.find((r) => r.id === row.resId);
    if (!res) return null;
    const room = res.roomsData?.[row.roomIdx];
    const g = room?.guests?.[row.guestIdx];
    if (!g) return null;

    return (
      <div
        style={{
          display: 'grid',
          gap: 10,
          padding: 12,
          borderRadius: 12,
          border: '1.5px solid var(--line)',
          background: '#fafbfc',
        }}
      >
        <b>{t('세부사항 수정', 'Edit details')}</b>
        <div className="grid-2">
          <div>
            <label className="label-text">{t('영문 성명', 'Name')}</label>
            <input
              className="input-field"
              value={g.name || ''}
              onChange={(e) =>
                patchGuest(res.id, row.roomIdx, row.guestIdx, 'name', e.target.value)
              }
            />
          </div>
          <div>
            <label className="label-text">{t('국적', 'Nationality')}</label>
            <input
              className="input-field"
              value={g.nationality || ''}
              onChange={(e) =>
                patchGuest(
                  res.id,
                  row.roomIdx,
                  row.guestIdx,
                  'nationality',
                  e.target.value,
                )
              }
            />
          </div>
          <div>
            <label className="label-text">{t('레벨', 'Level')}</label>
            <select
              className="input-field"
              value={g.level || 'LEVEL_1'}
              onChange={(e) =>
                patchGuest(res.id, row.roomIdx, row.guestIdx, 'level', e.target.value)
              }
            >
              {['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'INSTRUCTOR'].map(
                (lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ),
              )}
            </select>
          </div>
          <div>
            <label className="label-text">{t('종목', 'Discipline')}</label>
            <select
              className="input-field"
              value={
                DISCIPLINES.includes(g.discipline) ? g.discipline : 'CWT'
              }
              onChange={(e) =>
                patchGuest(
                  res.id,
                  row.roomIdx,
                  row.guestIdx,
                  'discipline',
                  e.target.value,
                )
              }
            >
              {DISCIPLINES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-text">{t('목표수심', 'Target depth')}</label>
            <input
              type="number"
              className="input-field"
              value={g.targetDepth ?? ''}
              onChange={(e) =>
                patchGuest(
                  res.id,
                  row.roomIdx,
                  row.guestIdx,
                  'targetDepth',
                  e.target.value === '' ? '' : Number(e.target.value) || 0,
                )
              }
            />
          </div>
          <div>
            <label className="label-text">
              {t('객실 타입', 'Room type')}
            </label>
            <select
              className="input-field"
              value={room.roomType || ''}
              onChange={(e) =>
                patchRoomType(res.id, row.roomIdx, e.target.value)
              }
            >
              <option value="">{t('선택', 'Select')}</option>
              <option value="NONE">{t('방 사용 안함', 'No room')}</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.nameKO || rt.nameEN || rt.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-text">{t('시작일', 'Start')}</label>
            <input
              type="date"
              className="input-field"
              value={g.startDate || ''}
              onChange={(e) =>
                patchGuest(
                  res.id,
                  row.roomIdx,
                  row.guestIdx,
                  'startDate',
                  e.target.value,
                )
              }
            />
          </div>
          <div>
            <label className="label-text">{t('종료일', 'End')}</label>
            <input
              type="date"
              className="input-field"
              value={g.endDate || ''}
              onChange={(e) =>
                patchGuest(
                  res.id,
                  row.roomIdx,
                  row.guestIdx,
                  'endDate',
                  e.target.value,
                )
              }
            />
          </div>
          <div>
            <label className="label-text">{t('체크인', 'Check-in')}</label>
            <select
              className="input-field"
              value={g.checkInTime || ''}
              onChange={(e) =>
                patchGuest(
                  res.id,
                  row.roomIdx,
                  row.guestIdx,
                  'checkInTime',
                  e.target.value,
                )
              }
            >
              <option value="">{t('선택', 'Select')}</option>
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-text">{t('체크아웃', 'Check-out')}</label>
            <select
              className="input-field"
              value={g.checkOutTime || ''}
              onChange={(e) =>
                patchGuest(
                  res.id,
                  row.roomIdx,
                  row.guestIdx,
                  'checkOutTime',
                  e.target.value,
                )
              }
            >
              <option value="">{t('선택', 'Select')}</option>
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="label-text" style={{ marginTop: 4 }}>
          {t('트레이닝 횟수', 'Training qty')}
        </div>
        <div className="grid-2 grid-2-dense">
          {trainingTypes.map((tr) => (
            <div key={tr.id}>
              <label className="label-text">{tr.name || tr.id}</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={Number(g.trainingCounts?.[tr.id]) || 0}
                onChange={(e) =>
                  patchTraining(
                    res.id,
                    row.roomIdx,
                    row.guestIdx,
                    tr.id,
                    e.target.value,
                  )
                }
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-primary"
            style={{ width: 'auto' }}
            disabled={savingId === res.id}
            onClick={() => saveEditedGuest(row)}
          >
            {savingId === res.id
              ? t('저장 중…', 'Saving…')
              : t('변경사항 저장', 'Save changes')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ width: 'auto' }}
            onClick={() => {
              if (editBaseline?.roomsData) {
                patchRes(res.id, { roomsData: editBaseline.roomsData });
              }
              setEditingKey('');
              setEditBaseline(null);
            }}
          >
            {t('취소', 'Cancel')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="app-shell">
      <RollingBanner ads={settings?.adsConfig} lang={lang} />
      <GuestTopBar
        t={t}
        lang={lang}
        setLang={(v) => {
          setLang(v);
          localStorage.setItem('guest_lang', v);
        }}
        myActive
        showLogout={authed}
        onLogout={logoutMy}
      />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          {t('내 예약 조회', 'My Reservations')}
        </h3>
        <p style={{ fontSize: 13, color: '#6b7684', marginTop: 0 }}>
          {t(
            '예약 시 사용한 이메일(로그인 ID)과 조회용 4자리 PIN으로 예약을 확인합니다.',
            'View bookings with the email (login ID) and 4-digit PIN used at booking.',
          )}
        </p>

        {!authed ? (
          <div className="grid-2" style={{ marginTop: 8 }}>
            <div>
              <label className="label-text">
                {t('이메일 (= 로그인 ID)', 'Email (= Login ID)')}
                <span className="required-star"> *</span>
              </label>
              <input
                className="input-field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label className="label-text">
                {t('조회용 비밀번호 (4자리)', '4-digit PIN')}
                <span className="required-star"> *</span>
              </label>
              <input
                className="input-field"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                placeholder="0000"
              />
            </div>
            <label
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                color: '#4e5968',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => {
                  const on = e.target.checked;
                  setRememberMe(on);
                  if (!on) {
                    persistMyLogin({ remember: false, email: '', pin: '' });
                  }
                }}
              />
              {t(
                '아이디·비밀번호 기억 (이 브라우저)',
                'Remember email & PIN (this browser)',
              )}
            </label>
            <div style={{ gridColumn: '1 / -1' }}>
              <button
                type="button"
                className="btn-primary"
                style={{ width: '100%' }}
                disabled={busy}
                onClick={lookup}
              >
                {busy
                  ? t('조회 중…', 'Looking up…')
                  : t('내 예약 불러오기', 'Load my bookings')}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <div style={{ fontWeight: 800, color: '#3182f6' }}>
                {email} · PIN {pin}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: 'auto' }}
                  onClick={() => setScheduleOpen(true)}
                >
                  {t('스케줄 대시보드', 'Schedule dashboard')}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ width: 'auto' }}
                  onClick={() => setTrashOpen(true)}
                >
                  🗑️ {t('휴지통', 'Trash')}
                  {trashed.length > 0 ? ` (${trashed.length})` : ''}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ width: 'auto' }}
                  onClick={lookup}
                  disabled={busy}
                >
                  {t('새로고침', 'Refresh')}
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
                gap: 12,
                alignItems: 'end',
                width: '100%',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <label className="label-text">
                  {t('다이버 이름 검색', 'Search by diver name')}
                </label>
                <input
                  className="input-field"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t(
                    '이름 / 예약자 / 상태',
                    'Name / holder / status',
                  )}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label className="label-text">{t('정렬', 'Sort')}</label>
                <select
                  className="input-field"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="submittedDesc">
                    {t('접수일 최신순', 'Newest submitted')}
                  </option>
                  <option value="dateAsc">
                    {t('체크인 빠른순', 'Check-in earliest')}
                  </option>
                  <option value="dateDesc">
                    {t('체크인 늦은순', 'Check-in latest')}
                  </option>
                  <option value="nameAsc">
                    {t('다이버 이름 A→Z', 'Diver name A→Z')}
                  </option>
                  <option value="nameDesc">
                    {t('다이버 이름 Z→A', 'Diver name Z→A')}
                  </option>
                  <option value="amountDesc">
                    {t('금액 높은순', 'Amount high→low')}
                  </option>
                  <option value="amountAsc">
                    {t('금액 낮은순', 'Amount low→high')}
                  </option>
                </select>
              </div>
            </div>

            {selectedResIds.size > 0 ? (
              <div
                className="selection-banner"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: '#e7f5ff',
                  border: '1.5px solid #74c0fc',
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 14 }}>
                  ✅{' '}
                  {t(
                    `예약 ${selectedResIds.size}건 선택`,
                    `${selectedResIds.size} booking(s) selected`,
                  )}
                </span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ width: 'auto' }}
                    onClick={() => setSelectedResIds(new Set())}
                  >
                    {t('선택 해제', 'Clear')}
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ width: 'auto', background: '#f04452' }}
                    disabled={deleting}
                    onClick={deleteSelected}
                  >
                    {deleting
                      ? t('삭제 중…', 'Deleting…')
                      : t('선택 삭제', 'Delete selected')}
                  </button>
                </div>
              </div>
            ) : null}

            {guestRows.length === 0 ? (
              <div style={{ color: '#8b95a1', fontSize: 13 }}>
                {search.trim()
                  ? t('검색 결과가 없습니다.', 'No matching bookings.')
                  : trashed.length
                    ? t(
                        '활성 예약이 없습니다. 휴지통에서 삭제된 예약을 확인하세요.',
                        'No active bookings. Check Trash for deleted ones.',
                      )
                    : t(
                        '조회된 예약이 없습니다. 새 예약을 진행하거나 상담해 주세요.',
                        'No bookings yet. Start a new booking or contact us.',
                      )}
              </div>
            ) : null}

            {guestRows.map((row) => {
              const res = rows.find((r) => r.id === row.resId);
              const key = guestKey(row);
              const editing = editingKey === key;
              return (
                <MyGuestRowCard
                  key={key}
                  t={t}
                  row={row}
                  settings={settings}
                  editing={editing}
                  saving={savingId === row.resId || deleting}
                  selected={selectedResIds.has(row.resId)}
                  onToggleSelect={() => toggleSelectRes(row.resId)}
                  hasDiscount={
                    res ? reservationHasAppliedDiscount(res, settings) : false
                  }
                  onPay={() => openPayFlow(row)}
                  onQuote={() => res && openQuotePreview(res, false)}
                  onQuoteDiscount={() => res && openQuotePreview(res, true)}
                  onApprovalMail={() => res && openApprovalMailPreview(res)}
                  onTransport={() => setTransportModal(row)}
                  onEdit={() => startEdit(row)}
                  onDelete={() => deleteOne(row)}
                >
                  {editing ? renderEditForm(row) : null}
                </MyGuestRowCard>
              );
            })}
          </div>
        )}

        <div
          style={{
            marginTop: 18,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <Link to="/" className="btn-ghost">
            ← {t('새 예약하러 가기', 'Start a new booking')}
          </Link>
          <a
            className="btn-ghost"
            href={whatsappHref(lang, 'consult')}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#0ca678', fontWeight: 800 }}
            onClick={(e) => {
              e.preventDefault();
              openWhatsApp(lang, 'consult');
            }}
          >
            💬 {t('상담하러가기', 'Contact us')} ({BRAND_ASSETS.whatsappName}{' '}
            {BRAND_ASSETS.whatsappDisplay})
          </a>
        </div>
      </div>

      {trashOpen ? (
        <MyTrashPanel
          t={t}
          items={trashed}
          restoringId={restoringId}
          onRestore={restoreTrashed}
          onClose={() => setTrashOpen(false)}
        />
      ) : null}

      {scheduleOpen ? (
        <div
          className="modal-backdrop"
          onClick={() => setScheduleOpen(false)}
          role="presentation"
        >
          <div
            className="modal-sheet"
            style={{ width: 'min(1100px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>
                  {t('스케줄 대시보드', 'Schedule dashboard')}
                </h3>
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: 12,
                    color: '#8b95a1',
                  }}
                >
                  {t(
                    '불러온 예약만 표시됩니다. 배지를 누르면 해당 예약 카드로 이동합니다.',
                    'Shows only your loaded bookings. Tap a badge to jump to that card.',
                  )}
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: 'auto', flexShrink: 0 }}
                onClick={() => setScheduleOpen(false)}
              >
                {t('닫기', 'Close')}
              </button>
            </div>
            <SchedulerTab
              t={t}
              lang={lang === 'EN' ? 'EN' : 'KO'}
              reservations={rows}
              onOpenQuote={({ resId }) => focusReservation(resId)}
            />
          </div>
        </div>
      ) : null}

      {payModal?.step === 'ask' ? (
        <div
          className="modal-backdrop"
          onClick={() => setPayModal(null)}
          role="presentation"
        >
          <div
            className="modal-sheet"
            style={{ width: 'min(440px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>
              {t('결제완료 하였나요?', 'Have you completed payment?')}
            </h3>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={async () => {
                  const row = payModal.row;
                  setPayModal(null);
                  try {
                    const claimedAt = new Date().toISOString();
                    await updateReservation(row.resId, {
                      guestPaymentClaimed: true,
                      guestPaymentClaimedAt: claimedAt,
                      updatedAt: claimedAt,
                    });
                    setRows((prev) =>
                      prev.map((r) =>
                        r.id === row.resId
                          ? {
                              ...r,
                              guestPaymentClaimed: true,
                              guestPaymentClaimedAt: claimedAt,
                              updatedAt: claimedAt,
                            }
                          : r,
                      ),
                    );
                    setInfoModal({
                      title: t('최종 승인 요청', 'Request final approval'),
                      body: t(
                        '관리자에게 최종 승인을 요청 합니다.\n관리자 화면의 결제확인(빨강) 버튼으로 더블체크됩니다.',
                        'Requesting final approval from the administrator.\nThe admin payment button turns red for double-check.',
                      ),
                    });
                  } catch (err) {
                    toast.error(
                      err?.message ||
                        t('요청 저장 실패', 'Failed to save request'),
                    );
                  }
                }}
              >
                {t('네', 'Yes')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => {
                  setPayModal(null);
                  setInfoModal({
                    title: t('결제 안내', 'Payment guide'),
                    body: paymentGuideText(),
                  });
                }}
              >
                {t('아니오', 'No')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {infoModal ? (
        <div
          className="modal-backdrop"
          onClick={() => setInfoModal(null)}
          role="presentation"
        >
          <div
            className="modal-sheet"
            style={{ width: 'min(480px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>{infoModal.title}</h3>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
              {infoModal.body}
            </p>
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => setInfoModal(null)}
            >
              {t('확인', 'OK')}
            </button>
          </div>
        </div>
      ) : null}

      {transportModal ? (
        <div
          className="modal-backdrop"
          onClick={() => setTransportModal(null)}
          role="presentation"
        >
          <div
            className="modal-sheet"
            style={{ width: 'min(420px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>
              🚐 {t('차량/기사', 'Transport')}
            </h3>
            {transportModal.assignedDriver ||
            transportModal.assignedVehicle ? (
              <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                <div>
                  👤 {t('기사', 'Driver')}:{' '}
                  <b>
                    {transportModal.assignedDriver ||
                      t('미배정', 'Unassigned')}
                  </b>
                </div>
                <div>
                  🚐 {t('차량', 'Vehicle')}:{' '}
                  <b>
                    {transportModal.assignedVehicle ||
                      t('미배정', 'Unassigned')}
                  </b>
                </div>
                {transportModal.airportPickup ? (
                  <div style={{ color: '#3182f6', fontWeight: 700 }}>
                    🛬 {t('픽업', 'Pickup')}{' '}
                    {transportModal.pickupTime || '--:--'}
                    {transportModal.pickupFlight
                      ? ` (${transportModal.pickupFlight})`
                      : ''}
                  </div>
                ) : null}
                {transportModal.airportDropoff ? (
                  <div style={{ color: '#e03131', fontWeight: 700 }}>
                    🛫 {t('드랍', 'Dropoff')}{' '}
                    {transportModal.dropoffTime || '--:--'}
                    {transportModal.dropoffFlight
                      ? ` (${transportModal.dropoffFlight})`
                      : ''}
                  </div>
                ) : null}
              </div>
            ) : (
              <p style={{ color: '#8b95a1' }}>
                {t(
                  '아직 차량/기사가 배정되지 않았습니다.',
                  'Vehicle/driver not assigned yet.',
                )}
              </p>
            )}
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', marginTop: 14 }}
              onClick={() => setTransportModal(null)}
            >
              {t('확인', 'OK')}
            </button>
          </div>
        </div>
      ) : null}

      {deleteBlockedModal ? (
        <div
          className="modal-backdrop"
          onClick={() => setDeleteBlockedModal(null)}
          role="presentation"
        >
          <div
            className="modal-sheet"
            style={{ width: 'min(480px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>
              {t('삭제 불가', 'Cannot delete')}
            </h3>
            <ul style={{ margin: '0 0 12px', paddingLeft: 18, lineHeight: 1.55 }}>
              {(deleteBlockedModal.reasons || []).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p style={{ fontWeight: 700, marginBottom: 8 }}>
              {t(
                '관리자에게 별도 문의 하세요.',
                'Please contact the administrator separately.',
              )}
            </p>
            <a
              className="btn-primary"
              href={whatsappHref(lang, 'delete')}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                textAlign: 'center',
                textDecoration: 'none',
                marginBottom: 8,
              }}
              onClick={(e) => {
                e.preventDefault();
                openWhatsApp(lang, 'delete');
              }}
            >
              💬 WhatsApp {BRAND_ASSETS.whatsappName}{' '}
              {BRAND_ASSETS.whatsappDisplay}
            </a>
            <button
              type="button"
              className="btn-secondary"
              style={{ width: '100%' }}
              onClick={() => setDeleteBlockedModal(null)}
            >
              {t('닫기', 'Close')}
            </button>
          </div>
        </div>
      ) : null}

      {penaltyModal ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-sheet"
            style={{ width: 'min(520px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: '#e03131' }}>
              ⚠️ {t('패널티 안내', 'Penalty notice')}
            </h3>
            <p style={{ lineHeight: 1.55 }}>
              {(lang === 'EN'
                ? penaltyModal.penalty.reasonsEN
                : penaltyModal.penalty.reasonsKO
              ).join('\n') ||
                t(
                  '일정 변경으로 패널티가 발생합니다.',
                  'This change incurs a penalty.',
                )}
            </p>
            <p style={{ fontWeight: 800 }}>
              {t('패널티 금액', 'Penalty amount')}: ₩
              {Math.round(penaltyModal.penalty.amountKRW).toLocaleString(
                'en-US',
              )}
              {penaltyModal.penalty.amountUSD
                ? ` / $${Math.round(penaltyModal.penalty.amountUSD).toLocaleString('en-US')}`
                : ''}
            </p>
            <p style={{ fontSize: 13, color: '#6b7684' }}>
              {t(
                '패널티는 견적서에 별도 항목으로 표시됩니다. 그래도 변경하시겠습니까?',
                'Penalty will appear as a separate quote line. Continue with the change?',
              )}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={() =>
                  applySaveWithOptionalPenalty(
                    penaltyModal.res,
                    penaltyModal.row.roomIdx,
                    penaltyModal.row.guestIdx,
                    penaltyModal.penalty,
                  )
                }
              >
                {t('네, 변경합니다', 'Yes, change')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setPenaltyModal(null)}
              >
                {t('아니오', 'No')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {quotePreviewOpen && quoteTarget && quoteProcessed ? (
        <div
          className="modal-backdrop"
          onClick={closeQuotePreview}
          role="presentation"
        >
          <div
            className="modal-sheet"
            style={{ width: 'min(780px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>
                {quoteMode === 'mail'
                  ? t('승인 안내서', 'Approval statement')
                  : t('견적서', 'Quote')}
              </h3>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: 'auto' }}
                disabled={quoteSaving || quoteMailing}
                onClick={closeQuotePreview}
              >
                {t('닫기', 'Close')}
              </button>
            </div>
            <div
              style={{
                maxHeight: '58vh',
                overflow: 'auto',
                border: '1.5px solid var(--line)',
                borderRadius: 12,
                background: '#fff',
                padding: 8,
              }}
            >
              <MyQuoteCapture
                ref={quoteRef}
                t={t}
                lang={lang}
                res={quoteTarget}
                processed={quoteProcessed}
                withDiscount={quoteDiscount}
                interactive
                titleKO={
                  quoteMode === 'mail' ? '승인 안내서' : undefined
                }
                titleEN={
                  quoteMode === 'mail' ? 'Approval Statement' : undefined
                }
              />
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 14,
              }}
            >
              <button
                type="button"
                className="btn-primary"
                style={{
                  flex: '1 1 180px',
                  backgroundColor: '#10b981',
                }}
                disabled={quoteSaving || quoteMailing}
                onClick={sendQuoteEmail}
              >
                {quoteMailing
                  ? t('발송 중…', 'Sending…')
                  : `✉️ ${t('메일로 보내기', 'Send email')}`}
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: '1 1 180px' }}
                disabled={quoteSaving || quoteMailing}
                onClick={saveQuotePreview}
              >
                {quoteSaving
                  ? t('저장 중…', 'Saving…')
                  : `💾 ${t('저장하기', 'Save')}`}
              </button>
            </div>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 12,
                color: '#8b95a1',
                textAlign: 'center',
              }}
            >
              {t(
                '메일: 이미지 링크(Storage) 또는 텍스트 안내 · 저장: 예약자명_시작일.png',
                'Email: image link (Storage) or text · Save: Holder_start.png',
              )}
            </p>
          </div>
        </div>
      ) : null}

      <SiteBrandFooter
        t={t}
        onBeforeHome={() => {
          if (authed) logoutMy();
        }}
      />
    </div>
  );
}
