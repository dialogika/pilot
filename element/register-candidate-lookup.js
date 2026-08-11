export function normalizeEmail(value) {
    return (value || "").toString().trim().toLowerCase();
}

export function buildInternsScreeningEmailQueries({ db, email, collection, query, where, limit }) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return [];
    return [
        query(
            collection(db, "interns_screening"),
            where("contact_info.email", "==", normalizedEmail),
            limit(10)
        ),
        query(
            collection(db, "interns_screening"),
            where("internship.email", "==", normalizedEmail),
            limit(10)
        )
    ];
}

export function pickOnboardingCandidate(rows) {
    return (rows || []).find((row) => {
        const data = row && row.data ? row.data : {};
        const recruitment = data.recruitment_status || {};
        const current = (recruitment.current || "").toString().toLowerCase();
        const decision = (recruitment.final_decision || "").toString().toLowerCase();
        return current === "onboarding" || current === "accepted" || decision === "accepted";
    }) || null;
}

export function mapInternsScreeningCandidate(docRow, normalizedEmail) {
    if (!docRow || !docRow.data) return null;
    const data = docRow.data || {};
    const basic = data.basic_info || {};
    const contact = data.contact_info || {};
    const internship = data.internship || data.internship_info || {};
    const education = data.education || {};

    const avatarUrl = basic.avatar_url || basic.img || basic.photo || data.photo || "";
    if (!avatarUrl) {
        throw new Error("INCOMPLETE_CANDIDATE_AVATAR");
    }

    return {
        source: "interns_screening",
        sourceDocId: docRow.id || "",
        email: normalizeEmail(internship.email || contact.email || normalizedEmail),
        candidate: {
            name: (basic.full_name || data.full_name || "").toString().trim(),
            email: normalizeEmail(internship.email || contact.email || normalizedEmail),
            phone: internship.whatsapp || contact.whatsapp || contact.phone || "",
            campus: internship.campus || education.campus || education.university || "",
            avatar_url: avatarUrl,
            photo: avatarUrl,
            position: internship.position || (data.employment && data.employment.position) || "",
            roleId: "internship",
            instagram: internship.instagram || "",
            linkedin: internship.linkedin || ""
        }
    };
}
