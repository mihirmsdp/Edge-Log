export function calcPnL(entry: number, exit: number, size: number, direction: "long" | "short", commission = 0) {
  if (!entry || !exit || !size) {
    return { dollar: 0, percent: 0 };
  }

  const gross = direction === "long" ? (exit - entry) * size : (entry - exit) * size;
  const net = gross - commission;
  const percent = direction === "long" ? ((exit - entry) / entry) * 100 : ((entry - exit) / entry) * 100;

  return {
    dollar: Number(net.toFixed(2)),
    percent: Number(percent.toFixed(2))
  };
}

export function calcRMultiple(entry: number, exit: number, stop: number, size: number, direction: "long" | "short", commission = 0) {
  if (!entry || !exit || !stop || !size) {
    return 0;
  }

  const pnl = calcPnL(entry, exit, size, direction, commission).dollar;
  const risk = calcRisk(entry, stop, size).dollar;

  if (!risk) {
    return 0;
  }

  return Number((pnl / risk).toFixed(2));
}

export function calcRisk(entry: number, stop: number, size: number) {
  if (!entry || !stop || !size) {
    return { dollar: 0 };
  }

  return {
    dollar: Number((Math.abs(entry - stop) * size).toFixed(2))
  };
}

export function calcHoldTime(entryDate?: string | null, exitDate?: string | null) {
  if (!entryDate || !exitDate) {
    return "Open";
  }

  const minutes = Math.max(0, Math.round((new Date(exitDate).getTime() - new Date(entryDate).getTime()) / 60000));
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours === 0 ? `${days}d` : `${days}d ${remainingHours}h`;
}
