function replaceInvalidSurrogates(input) {
    const text = (input ?? "").toString();
    let output = "";
    for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        const isHigh = code >= 0xD800 && code <= 0xDBFF;
        const isLow = code >= 0xDC00 && code <= 0xDFFF;

        if (isHigh) {
            const next = text.charCodeAt(i + 1);
            const hasPair = next >= 0xDC00 && next <= 0xDFFF;
            if (hasPair) {
                output += text[i] + text[i + 1];
                i += 1;
            } else {
                output += "\uFFFD";
            }
            continue;
        }
        if (isLow) {
            output += "\uFFFD";
            continue;
        }
        output += text[i];
    }
    return output;
}

export function normalizeWhatsappMessage(message) {
    const raw = (message ?? "").toString();
    // Keep line breaks stable across browsers and normalize Unicode composition.
    const withStableLineBreak = raw.replace(/\r\n?/g, "\n");
    const surrogateSafe = replaceInvalidSurrogates(withStableLineBreak);
    return typeof surrogateSafe.normalize === "function"
        ? surrogateSafe.normalize("NFC")
        : surrogateSafe;
}

export function encodeWhatsappMessage(message) {
    const normalized = normalizeWhatsappMessage(message);
    try {
        return encodeURIComponent(normalized);
    } catch (error) {
        return encodeURIComponent(replaceInvalidSurrogates(normalized));
    }
}

export function normalizeWhatsappNumber(value) {
    const digitsRaw = (value ?? "").toString().replace(/[^0-9]/g, "");
    if (!digitsRaw) return "";
    let digits = digitsRaw;
    if (digits.startsWith("0")) {
        digits = "62" + digits.slice(1);
    } else if (digits.startsWith("8")) {
        digits = "62" + digits;
    }
    return /^62\d{8,15}$/.test(digits) ? digits : "";
}

export function buildWhatsappDeepLink(phoneNumber, message) {
    const phone = normalizeWhatsappNumber(phoneNumber);
    if (!phone) return "";
    return "https://wa.me/" + phone + "?text=" + encodeWhatsappMessage(message || "");
}

export function hasReplacementCharacter(value) {
    return (value ?? "").toString().includes("\uFFFD");
}
