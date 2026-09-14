import { Injectable } from '@nestjs/common';

export interface SessionBounds {
  open: Date;
  close: Date;
}

const CHICAGO = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function chicagoWall(instant: Date) {
  const p = Object.fromEntries(CHICAGO.formatToParts(instant).map((x) => [x.type, x.value]));
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour) % 24,
    mi: Number(p.minute),
    s: Number(p.second),
  };
}

/** Minutes between Chicago wall time and UTC at `instant`: -300 in CDT, -360 in CST. */
function chicagoOffsetMinutes(instant: Date): number {
  const w = chicagoWall(instant);
  const asIfUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  return Math.round((asIfUtc - instant.getTime()) / 60_000);
}

/**
 * CME Globex session: opens 17:00 America/Chicago and closes 16:00 the next day.
 * "Today" for the snapshot is the session containing the given instant.
 */
@Injectable()
export class SessionClockService {
  sessionFor(instant: Date): SessionBounds {
    const w = chicagoWall(instant);
    let openWall = Date.UTC(w.y, w.m - 1, w.d, 17, 0, 0);
    if (w.h < 17) openWall -= 24 * 3_600_000;
    const open = new Date(openWall - chicagoOffsetMinutes(instant) * 60_000);
    return { open, close: new Date(open.getTime() + 23 * 3_600_000) };
  }
}
