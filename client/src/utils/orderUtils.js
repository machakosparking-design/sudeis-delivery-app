/**
 * Parses raw dropoff address and extracts any embedded personal/delivery notes.
 * Supported formats:
 *   "Westlands (Note: Gate code 1234)" -> { address: "Westlands", note: "Gate code 1234" }
 *   "Majengo (Leave at door)"          -> { address: "Majengo", note: "Leave at door" }
 *   "CBD Nairobi"                      -> { address: "CBD Nairobi", note: null }
 */
export function parseAddressAndNote(rawAddress) {
  if (!rawAddress || typeof rawAddress !== 'string') {
    return { address: '', note: null };
  }

  // Regex matches: (Note: ...), [Note: ...], (Personal Note: ...), (Instructions: ...)
  const noteMatch = rawAddress.match(/^(.*?)(?:\s*[\(\[](?:Note:\s*|Personal Note:\s*|Instructions:\s*)(.*?)[\)\]])$/i);
  if (noteMatch) {
    return {
      address: noteMatch[1].trim(),
      note: noteMatch[2].trim()
    };
  }

  // Fallback for simple parentheses at the end if not prefixed
  const generalParenMatch = rawAddress.match(/^(.*?)(?:\s*\((.*?)\))$/);
  if (generalParenMatch && generalParenMatch[2].length > 3) {
    return {
      address: generalParenMatch[1].trim(),
      note: generalParenMatch[2].trim()
    };
  }

  return { address: rawAddress.trim(), note: null };
}

/**
 * Combines destination address and optional personal note into a unified format
 */
export function formatDropoffWithNote(address, note) {
  const cleanAddr = (address || '').trim();
  const cleanNote = (note || '').trim();
  if (!cleanNote) return cleanAddr;
  return `${cleanAddr} (Note: ${cleanNote})`;
}
