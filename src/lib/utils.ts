import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs))
}

// Format bytes (e.g., 1024 -> "1.0 KB")
export function formatBytes(bytes: number | undefined | null): string {
  if (bytes == null || Number.isNaN(Number(bytes))) return '—';
  const b = Number(bytes);
  if (b === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  const value = parseFloat((b / Math.pow(k, i)).toFixed(1));
  return `${value} ${sizes[i]}`;
}

// Format ISO timestamp or Date into human-friendly string
export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch (e) {
    return iso;
  }
}
