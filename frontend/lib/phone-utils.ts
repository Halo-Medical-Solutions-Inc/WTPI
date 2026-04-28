export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "Unknown";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    const areaCode = cleaned.slice(1, 4);
    const first = cleaned.slice(4, 7);
    const second = cleaned.slice(7, 11);
    return `(${areaCode}) ${first}-${second}`;
  }
  if (cleaned.length === 10) {
    const areaCode = cleaned.slice(0, 3);
    const first = cleaned.slice(3, 6);
    const second = cleaned.slice(6, 10);
    return `(${areaCode}) ${first}-${second}`;
  }
  return phone;
}

export function isValidPhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith("1"));
}
