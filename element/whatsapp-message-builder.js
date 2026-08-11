/**
 * Centralized WhatsApp Message Builder
 * Builds all WhatsApp messages using per-category template system
 */

import {
    getStoredTemplates,
    interpolateTemplate,
    buildMessageFromTemplate,
    getTemplateIdForStageMode
} from "./template-manager.js";

/**
 * Build interview WhatsApp message
 * @param {Object} options - Build options
 * @param {string} options.candidateName - Candidate name
 * @param {string} options.positionName - Position name
 * @param {string} options.interviewDate - Formatted interview date
 * @param {string} options.interviewTime - Interview time
 * @param {string} options.mode - 'online' or 'offline'
 * @param {string} options.meetingLink - Meeting link (for online)
 * @param {string} options.interviewLocation - Interview location (for offline)
 * @param {string} options.category - Category: 'intern', 'team', or 'mentor' (default: 'team')
 * @returns {string|null} Generated WhatsApp message
 */
export function buildInterviewMessage(options = {}) {
    const {
        candidateName = "Kandidat",
        positionName = "Admin Marketing Intern",
        interviewDate = "-",
        interviewTime = "-",
        mode = "online",
        meetingLink = "",
        interviewLocation = "",
        category = "team"
    } = options;

    const templateId = getTemplateIdForStageMode("interview", mode, category);
    if (!templateId) {
        console.warn("No template found for interview mode:", mode, "category:", category);
        return null;
    }

    const tokens = {
        candidate_name: candidateName,
        position_name: positionName,
        interview_date: interviewDate,
        interview_time: interviewTime,
        meeting_link: meetingLink,
        interview_location: interviewLocation
    };

    return buildMessageFromTemplate(templateId, tokens, category);
}

/**
 * Build On Job Training (OJT) WhatsApp message
 * @param {Object} options - Build options
 * @param {string} options.candidateName - Candidate name
 * @param {string} options.ojtDate - Formatted OJT date (range)
 * @param {string} options.ojtTime - OJT time
 * @param {string} options.mode - 'online' or 'offline'
 * @param {string} options.meetingLink - Meeting link (for online)
 * @param {string} options.ojtLocation - OJT location (for offline)
 * @param {string} options.category - Category: 'intern', 'team', or 'mentor' (default: 'team')
 * @returns {string|null} Generated WhatsApp message
 */
export function buildOnJobTrainingMessage(options = {}) {
    const {
        candidateName = "Kandidat",
        ojtDate = "-",
        ojtTime = "-",
        mode = "online",
        meetingLink = "",
        ojtLocation = "",
        category = "team"
    } = options;

    const templateId = getTemplateIdForStageMode("on_job_training", mode, category);
    if (!templateId) {
        console.warn("No template found for On Job Training mode:", mode, "category:", category);
        return null;
    }

    const tokens = {
        candidate_name: candidateName,
        ojt_date: ojtDate,
        ojt_time: ojtTime,
        meeting_link: meetingLink,
        ojt_location: ojtLocation
    };

    return buildMessageFromTemplate(templateId, tokens, category);
}

/**
 * Build micro teaching WhatsApp message (backward-compatible wrapper)
 * @param {Object} options - Build options
 * @param {string} options.category - Category (default: 'team')
 * @returns {string|null} Generated WhatsApp message
 */
export function buildMicroTeachingMessage(options = {}) {
    const {
        candidateName = "Kandidat",
        microTeachingDate = "-",
        microTeachingTime = "-",
        mode = "online",
        meetingLink = "",
        microTeachingLocation = "",
        category = "team"
    } = options;

    // For mentor, use micro_teaching stage directly
    if (category === "mentor") {
        const templateId = getTemplateIdForStageMode("micro_teaching", mode, category);
        if (!templateId) {
            console.warn("No template found for Micro Teaching mode:", mode, "category:", category);
            return null;
        }
        const tokens = {
            candidate_name: candidateName,
            microteaching_date: microTeachingDate,
            microteaching_time: microTeachingTime,
            meeting_link: meetingLink,
            microteaching_location: microTeachingLocation
        };
        return buildMessageFromTemplate(templateId, tokens, category);
    }

    // For team/intern, delegate to OJT builder
    return buildOnJobTrainingMessage({
        candidateName,
        ojtDate: microTeachingDate,
        ojtTime: microTeachingTime,
        mode,
        meetingLink,
        ojtLocation: microTeachingLocation,
        category
    });
}

/**
 * Build onboarding WhatsApp message
 * @param {Object} options - Build options
 * @param {string} options.candidateName - Candidate name
 * @param {string} options.onboardingDate - Formatted onboarding date
 * @param {string} options.onboardingTime - Onboarding time
 * @param {string} options.onboardingLocation - Onboarding location
 * @param {string} options.category - Category: 'intern', 'team', or 'mentor' (default: 'team')
 * @returns {string|null} Generated WhatsApp message
 */
export function buildOnboardingMessage(options = {}) {
    const {
        candidateName = "Kandidat",
        onboardingDate = "-",
        onboardingTime = "-",
        onboardingLocation = "",
        category = "team"
    } = options;

    const tokens = {
        candidate_name: candidateName,
        onboarding_date: onboardingDate,
        onboarding_time: onboardingTime,
        onboarding_location: onboardingLocation
    };

    return buildMessageFromTemplate("onboarding", tokens, category);
}

/**
 * Build accepted WhatsApp message
 * @param {Object} options - Build options
 * @param {string} options.candidateName - Candidate name
 * @param {string} options.category - Category (default: 'team')
 * @returns {string|null} Generated WhatsApp message
 */
export function buildAcceptedMessage(options = {}) {
    const { candidateName = "Kandidat", category = "team" } = options;

    const tokens = {
        candidate_name: candidateName
    };

    return buildMessageFromTemplate("accepted", tokens, category);
}

/**
 * Build rejected WhatsApp message
 * @param {Object} options - Build options
 * @param {string} options.candidateName - Candidate name
 * @param {string} options.category - Category (default: 'team')
 * @returns {string|null} Generated WhatsApp message
 */
export function buildRejectedMessage(options = {}) {
    const { candidateName = "Kandidat", category = "team" } = options;

    const tokens = {
        candidate_name: candidateName
    };

    return buildMessageFromTemplate("rejected", tokens, category);
}

/**
 * Build any template message with custom tokens
 * @param {string} templateId - Template ID
 * @param {Object} tokens - Custom token values
 * @param {string} category - Category (default: 'team')
 * @returns {string|null} Generated message
 */
export function buildCustomMessage(templateId, tokens = {}, category = "team") {
    return buildMessageFromTemplate(templateId, tokens, category);
}

/**
 * Get all available message builders
 * @param {string} category - Category (default: 'team')
 * @returns {Object} Builders map
 */
export function getMessageBuilders(category = "team") {
    return {
        interview_online: (options) => buildInterviewMessage({ ...options, mode: "online", category }),
        interview_offline: (options) => buildInterviewMessage({ ...options, mode: "offline", category }),
        micro_teaching_online: (options) => buildMicroTeachingMessage({ ...options, mode: "online", category }),
        micro_teaching_offline: (options) => buildMicroTeachingMessage({ ...options, mode: "offline", category }),
        on_job_training_online: (options) => buildOnJobTrainingMessage({ ...options, mode: "online", category }),
        on_job_training_offline: (options) => buildOnJobTrainingMessage({ ...options, mode: "offline", category }),
        accepted: (options) => buildAcceptedMessage({ ...options, category }),
        rejected: (options) => buildRejectedMessage({ ...options, category }),
        custom: (templateId, tokens) => buildCustomMessage(templateId, tokens, category)
    };
}

/**
 * Preview template with sample tokens
 * @param {string} templateId - Template ID
 * @param {Object} sampleTokens - Sample token values
 * @param {string} category - Category (default: 'team')
 * @returns {string|null} Preview message
 */
export function previewTemplate(templateId, sampleTokens = {}, category = "team") {
    const defaults = {
        candidate_name: "Nama Kandidat",
        position_name: "Posisi",
        interview_date: "Hari, Tanggal Bulan Tahun",
        interview_time: "HH:MM",
        interview_location: "Alamat Lokasi",
        meeting_link: "https://meet.example.com/xyz",
        ojt_date: "Hari, Tanggal Bulan Tahun",
        ojt_time: "HH:MM",
        ojt_location: "Alamat Lokasi",
        microteaching_date: "Hari, Tanggal Bulan Tahun",
        microteaching_time: "HH:MM",
        microteaching_location: "Alamat Lokasi",
        onboarding_date: "Hari, Tanggal Bulan Tahun",
        onboarding_time: "HH:MM",
        onboarding_location: "Alamat Lokasi"
    };

    const tokens = { ...defaults, ...sampleTokens };
    return buildMessageFromTemplate(templateId, tokens, category);
}
