/**
 * Parses raw dropoff address and extracts any embedded personal/delivery notes and security PINs.
 * Supported formats:
 *   "Westlands (Note: Gate code 1234) [PIN: 4892]" -> { address: "Westlands", note: "Gate code 1234", pin: "4892" }
 *   "Majengo [PIN: 1234]"                          -> { address: "Majengo", note: null, pin: "1234" }
 *   "CBD Nairobi"                                  -> { address: "CBD Nairobi", note: null, pin: null }
 */
export function parseAddressAndNote(rawAddress) {
  if (!rawAddress || typeof rawAddress !== 'string') {
    return { address: '', note: null, pin: null };
  }

  let address = rawAddress.trim();
  let pin = null;

  // 1. Extract [PIN: 1234] or (PIN: 1234)
  const pinMatch = address.match(/^(.*?)(?:\s*[\(\[]PIN:\s*(\d{4})[\)\]])(.*)$/i);
  if (pinMatch) {
    address = (pinMatch[1] + (pinMatch[3] || '')).trim();
    pin = pinMatch[2];
  }

  // 2. Regex matches: (Note: ...), [Note: ...], (Personal Note: ...), (Instructions: ...)
  const noteMatch = address.match(/^(.*?)(?:\s*[\(\[](?:Note:\s*|Personal Note:\s*|Instructions:\s*)(.*?)[\)\]])$/i);
  if (noteMatch) {
    return {
      address: noteMatch[1].trim(),
      note: noteMatch[2].trim(),
      pin
    };
  }

  // 3. Fallback for simple parentheses at the end if not prefixed
  const generalParenMatch = address.match(/^(.*?)(?:\s*\((.*?)\))$/);
  if (generalParenMatch && generalParenMatch[2].length > 3) {
    return {
      address: generalParenMatch[1].trim(),
      note: generalParenMatch[2].trim(),
      pin
    };
  }

  return { address: address.trim(), note: null, pin };
}

/**
 * Combines destination address, optional personal note, and optional 4-digit PIN into a unified format
 */
export function formatDropoffWithNote(address, note, pin) {
  let res = (address || '').trim();
  const cleanNote = (note || '').trim();
  const cleanPin = (pin || '').trim();

  if (cleanNote) {
    res = `${res} (Note: ${cleanNote})`;
  }
  if (cleanPin) {
    res = `${res} [PIN: ${cleanPin}]`;
  }
  return res;
}

