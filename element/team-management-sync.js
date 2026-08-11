import {
    collection,
    query,
    where,
    limit,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const TEAM_MEMBER_DIVISIONS = [
    "Human Resources",
    "Marketing",
    "Client & Product",
    "Branding"
];

const ROLE_NAME_TO_DIVISION = {
    "branding/social media specialist": "Branding",
    "admin marketing": "Marketing",
    "client & product/admin kelas": "Client & Product"
};

const TEAM_COLLECTION = "team_management";
const USER_COLLECTION_CANDIDATES = ["users", "user"];

function firstValue(...values) {
    for (const value of values) {
        if (value === null || value === undefined) continue;
        const text = value.toString().trim();
        if (text) return text;
    }
    return "";
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeTeamDivision(value) {
    const raw = (value || "").toString().trim();
    return TEAM_MEMBER_DIVISIONS.includes(raw) ? raw : "";
}

function normalizeRoleName(value) {
    return (value || "").toString().trim().toLowerCase();
}

export function resolveDivisionFromRoleName(roleName) {
    const normalized = normalizeRoleName(roleName);
    if (!normalized) return "";
    return ROLE_NAME_TO_DIVISION[normalized] || "";
}

export async function resolveCandidateDivision(db, candidateCollection, candidateId, fallbackDivision = "") {
    if (!db || !candidateCollection || !candidateId) return normalizeTeamDivision(fallbackDivision);
    const candidateSnap = await getDoc(doc(db, candidateCollection, candidateId));
    if (!candidateSnap.exists()) return normalizeTeamDivision(fallbackDivision);
    const sourceData = candidateSnap.data() || {};
    const internship = sourceData.internship || sourceData.internship_info || {};
    const scouting = sourceData.scouting_info || {};
    const roleName = firstValue(sourceData.role_name, internship.role_name, scouting.role_name);
    return resolveDivisionFromRoleName(roleName) || normalizeTeamDivision(fallbackDivision);
}

function buildDocumentList(sourceData, internship, teamData) {
    const documents = [];
    const appendUrl = (label, url) => {
        const cleanUrl = firstValue(url);
        if (!cleanUrl) return;
        documents.push({
            fileName: label,
            fileUrl: cleanUrl,
            filePath: "",
            uploadedAt: new Date().toISOString()
        });
    };

    appendUrl("Resume / CV", teamData.resume_url || internship.resume_url || sourceData.resume_url || sourceData.cv_url);
    appendUrl("Portfolio", teamData.portfolio_url || teamData.portofolio_url || internship.portfolio_url || sourceData.portfolio_url);

    return documents.concat(
        asArray(sourceData.documents),
        asArray(internship.documents),
        asArray(teamData.documents)
    );
}

export function getCandidateUserId(sourceData = {}) {
    const basic = sourceData.basic_info || {};
    const contact = sourceData.contact_info || {};
    const internship = sourceData.internship || sourceData.internship_info || {};
    const scouting = sourceData.scouting_info || {};
    return firstValue(
        sourceData.userId,
        sourceData.user_id,
        sourceData.uid,
        sourceData.auth_uid,
        basic.userId,
        basic.user_id,
        contact.userId,
        contact.user_id,
        internship.userId,
        internship.user_id,
        scouting.userId,
        scouting.user_id
    );
}

export function buildTeamMemberPayload(sourceData = {}, candidateId, division, source = "candidate-team") {
    const basic = sourceData.basic_info || {};
    const contact = sourceData.contact_info || {};
    const education = sourceData.education || {};
    const internship = sourceData.internship || sourceData.internship_info || {};
    const scouting = sourceData.scouting_info || {};
    const profiling = sourceData.profiling || {};
    const teamData = Array.isArray(sourceData.team) ? (sourceData.team[0] || {}) : (sourceData.team || {});
    const roleName = firstValue(sourceData.role_name, internship.role_name, scouting.role_name);
    const selectedDivision = resolveDivisionFromRoleName(roleName) || normalizeTeamDivision(division);
    const userId = getCandidateUserId(sourceData);

    return {
        candidateId: candidateId || "",
        userId,
        name: firstValue(basic.full_name, scouting.full_name, sourceData.full_name, basic.name, sourceData.name),
        email: firstValue(internship.email, contact.email, basic.email, sourceData.email),
        whatsapp: firstValue(internship.whatsapp, contact.whatsapp, contact.phone, sourceData.whatsapp, sourceData.phone),
        division: selectedDivision,
        department: selectedDivision,
        originalDivision: selectedDivision,
        status: "Active",
        source,
        role_name: roleName,
        address: firstValue(internship.address, contact.address, sourceData.address),
        birthDate: firstValue(basic.birthDate, basic.birth_date, contact.birthDate, contact.birth_date, internship.birthDate, internship.birth_date, sourceData.birthDate, sourceData.birth_date),
        startDate: "",
        endDate: "",
        instagram: firstValue(internship.instagram, contact.instagram, sourceData.instagram),
        linkedin: firstValue(internship.linkedin, contact.linkedin, scouting.channel_url, sourceData.linkedin),
        bank: "",
        accountNumber: "",
        fee: "",
        campus: firstValue(internship.campus, education.campus, education.university, contact.campus),
        major: firstValue(internship.major, education.major, education.department, education.faculty),
        roleName,
        portfolioUrl: firstValue(teamData.portfolio_url, teamData.portofolio_url, internship.portfolio_url, sourceData.portfolio_url),
        portfolioLink: firstValue(internship.portfolio_link, sourceData.portfolio_link, teamData.portfolio_link, teamData.portofolio_link),
        resumeUrl: firstValue(teamData.resume_url, internship.resume_url, sourceData.resume_url, sourceData.cv_url),
        documents: buildDocumentList(sourceData, internship, teamData),
        candidateSnapshot: sourceData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };
}

export async function promptTeamDivision(title = "Pilih Divisi Team") {
    if (window.Swal && typeof window.Swal.fire === "function") {
        const inputOptions = TEAM_MEMBER_DIVISIONS.reduce((acc, division) => {
            acc[division] = division;
            return acc;
        }, {});
        const result = await window.Swal.fire({
            title,
            text: "Pilih divisi tujuan sebelum kandidat dimasukkan ke Team Management.",
            input: "select",
            inputOptions,
            inputPlaceholder: "Pilih divisi",
            showCancelButton: true,
            confirmButtonText: "Lanjutkan",
            cancelButtonText: "Batal",
            confirmButtonColor: "#16a34a",
            inputValidator: (value) => {
                if (!normalizeTeamDivision(value)) {
                    return "Pilih salah satu divisi team.";
                }
                return null;
            }
        });
        return result.isConfirmed ? normalizeTeamDivision(result.value) : "";
    }

    const selected = window.prompt("Pilih Divisi Team:\n- " + TEAM_MEMBER_DIVISIONS.join("\n- "));
    return normalizeTeamDivision(selected);
}

async function findExistingTeamMember(db, candidateId, userId) {
    if (candidateId) {
        const byCandidate = await getDocs(query(collection(db, TEAM_COLLECTION), where("candidateId", "==", candidateId), limit(1)));
        if (!byCandidate.empty) return byCandidate.docs[0];
    }
    if (userId) {
        const byUser = await getDocs(query(collection(db, TEAM_COLLECTION), where("userId", "==", userId), limit(1)));
        if (!byUser.empty) return byUser.docs[0];
    }
    return null;
}

async function markCandidateAsTeamMember(db, candidateCollection, candidateId, memberId, division) {
    if (!candidateCollection || !candidateId) return;
    await updateDoc(doc(db, candidateCollection, candidateId), {
        isTeamMember: true,
        teamManagementId: memberId || "",
        teamMemberDivision: division || "",
        teamMemberDepartment: division || "",
        teamMemberAddedAt: serverTimestamp(),
        "recruitment_status.is_team_member": true,
        "recruitment_status.team_management_id": memberId || "",
        "recruitment_status.team_member_division": division || "",
        "recruitment_status.team_member_department": division || ""
    });
}

async function updateRoleIfCandidate(userRef) {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return false;
    const data = userSnap.data() || {};
    const roleId = firstValue(data.role_id, data.roleId).toLowerCase();
    if (roleId === "candidate") {
        await updateDoc(userRef, {
            role_id: "staff",
            updatedAt: serverTimestamp()
        });
    }
    return true;
}

async function updateCandidateUserRole(db, userId, email) {
    for (const collectionName of USER_COLLECTION_CANDIDATES) {
        if (userId) {
            const updatedById = await updateRoleIfCandidate(doc(db, collectionName, userId));
            if (updatedById) return true;
        }
        if (email) {
            const userByEmail = await getDocs(query(collection(db, collectionName), where("email", "==", email), limit(1)));
            if (!userByEmail.empty) {
                await updateRoleIfCandidate(userByEmail.docs[0].ref);
                return true;
            }
        }
    }
    return false;
}

export async function syncAcceptedCandidateToTeamManagement({
    db,
    candidateCollection,
    candidateId,
    division,
    source = "candidate-team"
}) {
    if (!db || !candidateCollection || !candidateId) {
        throw new Error("Data kandidat belum lengkap untuk sinkronisasi Team Management.");
    }

    const candidateRef = doc(db, candidateCollection, candidateId);
    const candidateSnap = await getDoc(candidateRef);
    if (!candidateSnap.exists()) {
        throw new Error("Data kandidat tidak ditemukan.");
    }

    const sourceData = candidateSnap.data() || {};
    const userId = getCandidateUserId(sourceData);
    const roleName = firstValue(
        sourceData.role_name,
        sourceData.internship && sourceData.internship.role_name,
        sourceData.internship_info && sourceData.internship_info.role_name,
        sourceData.scouting_info && sourceData.scouting_info.role_name
    );
    const selectedDivision = resolveDivisionFromRoleName(roleName) || normalizeTeamDivision(division);
    const existing = await findExistingTeamMember(db, candidateId, userId);
    if (existing) {
        const existingData = existing.data() || {};
        await markCandidateAsTeamMember(db, candidateCollection, candidateId, existing.id, existingData.division || selectedDivision);
        return {
            status: "duplicate",
            memberId: existing.id,
            division: existingData.division || selectedDivision
        };
    }

    if (!selectedDivision) {
        throw new Error("Department Team tidak dapat ditentukan dari role kandidat.");
    }

    const payload = buildTeamMemberPayload(sourceData, candidateId, selectedDivision, source);
    const memberRef = await addDoc(collection(db, TEAM_COLLECTION), payload);
    await markCandidateAsTeamMember(db, candidateCollection, candidateId, memberRef.id, selectedDivision);
    await updateCandidateUserRole(db, userId, payload.email);

    return {
        status: "created",
        memberId: memberRef.id,
        division: selectedDivision
    };
}
