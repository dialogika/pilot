const INTERVIEW_TIME_ERROR_MESSAGE = "Jadwal interview hanya tersedia antara pukul 09.00 - 18.00 WIB";

function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeInterviewMode(modeValue) {
    const value = (modeValue || "").toString().trim().toLowerCase();
    return value === "online" ? "online" : "offline";
}

export function isInterviewTimeWithinRange(input) {
    const dateObj = toDate(input);
    if (!dateObj) return false;
    const minutes = (dateObj.getHours() * 60) + dateObj.getMinutes();
    return minutes >= (9 * 60) && minutes <= (18 * 60);
}

export function getInterviewTimeErrorMessage() {
    return INTERVIEW_TIME_ERROR_MESSAGE;
}

export function formatInterviewScheduleLabel(input, nowDate) {
    const dateObj = toDate(input);
    if (!dateObj) return "-";
    const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(dateObj);
    const dateText = new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    }).format(dateObj);
    const timeText = new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).format(dateObj).replace(":", ".");
    return weekday + ", " + dateText + " - " + timeText + " WIB";
}

export function getInterviewScheduleStatus(input, nowInput) {
    const target = toDate(input);
    if (!target) return "upcoming";
    const now = toDate(nowInput) || new Date();
    const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (targetDay.getTime() === nowDay.getTime()) {
        return "today";
    }
    return target.getTime() < now.getTime() ? "completed" : "upcoming";
}

export function getInterviewScheduleBadgeMeta(statusInput) {
    const status = (statusInput || "").toString().trim().toLowerCase();
    if (status === "today") {
        return { label: "Today", className: "interview-schedule-badge badge-today" };
    }
    if (status === "completed") {
        return { label: "Completed", className: "interview-schedule-badge badge-completed" };
    }
    return { label: "Upcoming", className: "interview-schedule-badge badge-upcoming" };
}

export function formatInterviewerSummary(namesInput) {
    const names = Array.isArray(namesInput)
        ? namesInput.map(name => (name || "").toString().trim()).filter(Boolean)
        : [];
    if (!names.length) {
        return {
            shortText: "Interviewer: -",
            fullText: "-"
        };
    }
    if (names.length <= 2) {
        const text = names.join(", ");
        return {
            shortText: "Interviewer: " + text,
            fullText: text
        };
    }
    return {
        shortText: "Interviewer: " + names[0] + ", " + names[1] + " +" + (names.length - 2),
        fullText: names.join(", ")
    };
}

export function buildInterviewLocationLine(modeInput, meetingLinkInput, locationInput) {
    const mode = normalizeInterviewMode(modeInput);
    const meetingLink = (meetingLinkInput || "").toString().trim();
    const location = (locationInput || "").toString().trim();
    if (mode === "online") {
        return "Link Meeting : " + (meetingLink || "-");
    }
    return "Lokasi : " + (location || "-");
}

function normalizeTextToken(value) {
    return (value || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function toDateKey(dateObj) {
    if (!dateObj) return "";
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
}

function getScheduleTimeValue(input) {
    const dateObj = toDate(input);
    if (!dateObj) return Number.POSITIVE_INFINITY;
    return dateObj.getTime();
}

function isSameOrAfterToday(dateObj, nowInput) {
    if (!dateObj) return false;
    const now = toDate(nowInput) || new Date();
    const targetDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return targetDay.getTime() >= today.getTime();
}

export function formatInterviewScheduleDateTimeLabel(input) {
    const dateObj = toDate(input);
    if (!dateObj) return "-";
    const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(dateObj);
    const dateText = new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(dateObj);
    const timeText = new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).format(dateObj).replace(":", ".");
    return weekday + ", " + dateText + " " + timeText + " WIB";
}

export function filterAndSortInterviewSchedules(entriesInput, optionsInput) {
    const entries = Array.isArray(entriesInput) ? entriesInput.slice() : [];
    const options = optionsInput || {};
    const query = normalizeTextToken(options.query || "");
    const dateFilter = (options.date || "").toString().trim();
    const sort = (options.sort || "nearest").toString().trim().toLowerCase();

    const filtered = entries.filter((entry) => {
        const candidateName = (entry && entry.candidateName ? entry.candidateName : "").toString();
        const interviewerNames = Array.isArray(entry && entry.interviewerNames) ? entry.interviewerNames : [];
        const scheduleSource = entry ? (entry.scheduleAt || entry.scheduleIso || entry.interviewSchedule) : null;
        const scheduleDate = toDate(scheduleSource);
        const searchHaystack = normalizeTextToken(candidateName + " " + interviewerNames.join(" "));
        const matchesQuery = !query || searchHaystack.includes(query);
        const matchesDate = !dateFilter || toDateKey(scheduleDate) === dateFilter;
        const matchesDefaultDateWindow = !!dateFilter || isSameOrAfterToday(scheduleDate, options.now);
        return matchesQuery && matchesDate && matchesDefaultDateWindow;
    });

    const compareByName = (a, b, desc) => {
        const left = normalizeTextToken(a && a.candidateName ? a.candidateName : "");
        const right = normalizeTextToken(b && b.candidateName ? b.candidateName : "");
        return desc ? right.localeCompare(left, "id") : left.localeCompare(right, "id");
    };

    filtered.sort((a, b) => {
        const timeA = getScheduleTimeValue(a ? (a.scheduleAt || a.scheduleIso || a.interviewSchedule) : null);
        const timeB = getScheduleTimeValue(b ? (b.scheduleAt || b.scheduleIso || b.interviewSchedule) : null);

        if (sort === "farthest") {
            if (timeA === Number.POSITIVE_INFINITY && timeB !== Number.POSITIVE_INFINITY) return 1;
            if (timeB === Number.POSITIVE_INFINITY && timeA !== Number.POSITIVE_INFINITY) return -1;
            if (timeA !== timeB) return timeB - timeA;
            return compareByName(a, b, false);
        }

        if (sort === "candidate_asc") return compareByName(a, b, false);
        if (sort === "candidate_desc") return compareByName(a, b, true);

        if (timeA === Number.POSITIVE_INFINITY && timeB !== Number.POSITIVE_INFINITY) return 1;
        if (timeB === Number.POSITIVE_INFINITY && timeA !== Number.POSITIVE_INFINITY) return -1;
        if (timeA !== timeB) return timeA - timeB;
        return compareByName(a, b, false);
    });

    return filtered;
}
