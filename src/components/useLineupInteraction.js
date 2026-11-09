import { useCallback, useEffect, useRef, useState } from 'react';
import { WHITEBOARD_SYSTEMS } from '../data/whiteboardSlots';

const DESTINATIONS = new Set([...WHITEBOARD_SYSTEMS['5-1'].slots.map(({ key }) => key), 'bench']);

export default function useLineupInteraction({ roster, scope, disabled, onAssign, boardRef }) {
  const [selectedId, setSelectedId] = useState(null);
  const [drag, setDrag] = useState(null);
  const [overSlot, setOverSlot] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const gesture = useRef(null);
  const clickGuard = useRef(null);
  const frame = useRef(null);
  const latest = useRef(null);
  latest.current = { roster, scope, disabled, onAssign, selectedId };

  const clearGesture = useCallback((render = true) => {
    const current = gesture.current;
    gesture.current = null;
    if (frame.current) {
      frame.current.window.cancelAnimationFrame(frame.current.id);
      frame.current = null;
    }
    if (current?.target.hasPointerCapture?.(current.pointerId)) current.target.releasePointerCapture(current.pointerId);
    if (render) { setDrag(null); setOverSlot(null); }
  }, []);

  const cancel = useCallback(() => {
    if (gesture.current) clickGuard.current = gesture.current.playerId;
    clearGesture();
    setSelectedId(null);
  }, [clearGesture]);

  useEffect(() => { cancel(); }, [scope, disabled, cancel]);
  useEffect(() => {
    if (selectedId != null && !roster.some((player) => player.id === selectedId)) cancel();
  }, [roster, selectedId, cancel]);
  useEffect(() => {
    const escape = (event) => {
      if (event.key === 'Escape' && (gesture.current || latest.current.selectedId != null)) {
        event.preventDefault();
        cancel();
        setAnnouncement('Selección cancelada.');
      }
    };
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('keydown', escape); clearGesture(false); };
  }, [cancel, clearGesture]);

  const blocked = (control) => latest.current.disabled || control?.matches?.(':disabled') || control?.closest?.('fieldset:disabled');
  const destinationAt = (current, x, y) => {
    const target = current.target.ownerDocument?.elementFromPoint(x, y)?.closest('[data-lineup-slot]');
    const slot = target?.getAttribute('data-lineup-slot');
    return target && boardRef.current?.contains(target) && !blocked(target) && DESTINATIONS.has(slot) ? { slot, target } : null;
  };

  const chooseSlot = (slot, explicitId, target) => {
    if (blocked(target) || !DESTINATIONS.has(slot)) return;
    const state = latest.current;
    const id = explicitId ?? state.selectedId;
    const previous = slot === 'bench' ? null : state.roster.find((player) => player.slot === slot);
    if (id == null) {
      if (previous) { setSelectedId(previous.id); setAnnouncement(`${previous.name} seleccionado. Elige una posición o el banquillo.`); }
      return;
    }
    const player = state.roster.find((item) => item.id === id);
    if (!player) { cancel(); return; }
    state.onAssign(slot === 'bench' ? null : slot, id);
    cancel();
    setAnnouncement(`${player.name} ${slot === 'bench' ? 'vuelve al banquillo' : `ocupa ${slot}`}.${previous && previous.id !== id ? ` ${previous.name} vuelve al banquillo.` : ''}`);
    target?.focus?.({ preventScroll: true });
  };

  const selectPlayer = (id, event) => {
    if (blocked(event?.currentTarget)) return;
    if (event?.detail > 0 && clickGuard.current === id) { clickGuard.current = null; return; }
    if (!latest.current.roster.some((player) => player.id === id)) return;
    const next = latest.current.selectedId === id ? null : id;
    setSelectedId(next);
    const player = latest.current.roster.find((item) => item.id === id);
    setAnnouncement(next == null ? 'Selección cancelada.' : `${player.name} seleccionado. Elige una posición en la pista.`);
  };

  const startAutoScroll = (current) => {
    const view = current.target.ownerDocument?.defaultView;
    if (!view?.requestAnimationFrame || frame.current) return;
    const tick = () => {
      if (gesture.current !== current || !current.active) { frame.current = null; return; }
      const edge = 64;
      const delta = current.y < edge ? -Math.ceil((edge - current.y) / 5)
        : current.y > view.innerHeight - edge ? Math.ceil((current.y - view.innerHeight + edge) / 5) : 0;
      if (delta) {
        view.scrollBy(0, Math.max(-18, Math.min(18, delta)));
        setOverSlot(destinationAt(current, current.x, current.y)?.slot ?? null);
      }
      frame.current = { window: view, id: view.requestAnimationFrame(tick) };
    };
    frame.current = { window: view, id: view.requestAnimationFrame(tick) };
  };

  const sourceHandlers = (id, allowTouch = true) => ({
    onPointerDown(event) {
      if (event.button !== 0 || event.isPrimary === false || blocked(event.currentTarget)
        || (!allowTouch && event.pointerType !== 'mouse')) return;
      clearGesture();
      clickGuard.current = null;
      gesture.current = { playerId: id, pointerId: event.pointerId, target: event.currentTarget,
        startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, scope: latest.current.scope, active: false };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove(event) {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (blocked(current.target) || current.scope !== latest.current.scope) { cancel(); return; }
      current.x = event.clientX;
      current.y = event.clientY;
      if (!current.active && Math.hypot(current.x - current.startX, current.y - current.startY) < 6) return;
      event.preventDefault();
      current.active = true;
      setSelectedId(id);
      setDrag({ id, x: current.x, y: current.y });
      setOverSlot(destinationAt(current, current.x, current.y)?.slot ?? null);
      startAutoScroll(current);
    },
    onPointerUp(event) {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const destination = current.active && current.scope === latest.current.scope && !blocked(current.target)
        ? destinationAt(current, event.clientX, event.clientY) : null;
      clearGesture();
      if (current.active) {
        clickGuard.current = id;
        setSelectedId(null);
        if (destination) chooseSlot(destination.slot, id, destination.target);
        else setAnnouncement('Movimiento cancelado. La alineación no ha cambiado.');
      }
    },
    onPointerCancel(event) {
      if (gesture.current?.pointerId !== event.pointerId) return;
      if (gesture.current.active) clickGuard.current = id;
      cancel();
    },
    onLostPointerCapture(event) {
      if (gesture.current?.pointerId === event.pointerId) cancel();
    }
  });

  return { selectedPlayer: roster.find((player) => player.id === selectedId) || null,
    drag, overSlot, announcement, selectPlayer, chooseSlot, sourceHandlers, cancel };
}
