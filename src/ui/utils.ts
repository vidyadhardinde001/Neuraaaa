// Utility function to join class names conditionally
export function cn(...args: any[]): string {
  return args.filter(Boolean).join(' ');
}
