/**
 * Centralized Template Manager for Recruitment WhatsApp System
 * Handles per-category template definitions, storage, interpolation, and persistence
 * Categories: intern, team, mentor
 */

/**
 * Per-category template definitions map
 */
export const CATEGORY_TEMPLATE_DEFS = {
    intern: [
        {
            id: "interview_offline",
            title: "Interview Offline",
            description: "Template untuk undangan interview offline kandidat intern.",
            stage: "interview",
            mode: "offline",
            requiredTokens: ["{candidate_name}", "{position_name}", "{interview_date}", "{interview_time}", "{interview_location}"],
            defaultTemplate: "*[REKRUTMEN DIALOGIKA]*\n\nHalo Kak {candidate_name}!\n\nTerima kasih sudah mengikuti tahapan rekrutmen posisi {position_name} di Dialogika dengan antusias. Selanjutnya kami ucapkan selamat karena telah lolos pada tahap screening!\n\nMaka dari itu, kami akan mengundang kakak untuk mengikuti tahapan selanjutnya, yaitu tahap wawancara dan verifikasi jadwal. Pelaksanaan wawancara akan dilakukan secara offline pada:\n\n*Tanggal* : {interview_date}\n*Waktu*   : {interview_time} WIB\n*Lokasi*  : {interview_location}\n\nKandidat dimohon untuk hadir maksimal 5 menit sebelum jadwal wawancara serta menggunakan pakaian yang sopan dan rapi, serta membawa laptop.\n\nTerima kasih atas perhatiannya\n\nSalam,\n\nHuman Resource Dialogika\n\nMohon untuk konfirmasi kehadiran dengan membalas pesan ini. Terima kasih.\n\n*reschedule hanya bisa dilakukan 1x maksimal H-1"
        },
        {
            id: "interview_online",
            title: "Interview Online",
            description: "Template untuk undangan interview online kandidat intern.",
            stage: "interview",
            mode: "online",
            requiredTokens: ["{candidate_name}", "{position_name}", "{interview_date}", "{interview_time}", "{meeting_link}"],
            defaultTemplate: "*[REKRUTMEN DIALOGIKA]*\n\nHalo Kak {candidate_name}!\n\nTerima kasih sudah mengikuti tahapan rekrutmen posisi {position_name} di Dialogika dengan antusias. Selanjutnya, kami ucapkan selamat karena Kakak telah lolos pada tahap screening!\n\nMaka dari itu, kami mengundang Kakak untuk mengikuti tahapan selanjutnya, yaitu wawancara secara online dan verifikasi jadwal yang akan dilaksanakan pada:\n\n*Tanggal* : {interview_date}\n*Waktu*   : {interview_time} WIB\n*Link Meeting* : {meeting_link}\n\nKandidat dimohon untuk bergabung maksimal 5 menit sebelum jadwal wawancara, menggunakan pakaian yang sopan dan rapi, serta memastikan koneksi internet dalam kondisi stabil.\n\nTerima kasih atas perhatiannya.\n\nSalam,\n\nHuman Resource Dialogika"
        },
        {
            id: "accepted",
            title: "Accepted",
            description: "Template untuk notifikasi kandidat intern diterima.",
            stage: "decision",
            requiredTokens: ["{candidate_name}"],
            defaultTemplate: "*[Acceptance Letter]*\n\nHalo {candidate_name}!\n\nTerima kasih atas partisipasi dan antusiasmenya dalam mengikuti proses rekrutmen Program Internship di Dialogika.\n\nSetelah melalui proses seleksi dan evaluasi, kami dengan senang hati menginformasikan bahwa Kakak diterima sebagai Intern di Dialogika.\n\nSelamat bergabung bersama tim!\n\nInformasi mengenai jadwal onboarding dan kelengkapan administrasi akan kami kirimkan dalam waktu dekat.\n\nTerima kasih dan sampai jumpa di hari pertama magang.\n\nSalam hormat,\n\nHR Dialogika"
        },
        {
            id: "onboarding",
            title: "Onboarding",
            description: "Template untuk undangan onboarding kandidat intern.",
            stage: "onboarding",
            requiredTokens: ["{onboarding_date}", "{onboarding_time}", "{onboarding_location}"],
            defaultTemplate: "*Undangan Onboarding*\n\n*[Recruitment Dialogika Internship- WELCOME!]*\n\nSelamat! Dengan ini kami menginformasikan bahwa kamu telah diterima sebagai Intern di Dialogika. Kami sangat senang menyambutmu menjadi bagian dari tim kami.\n\nSebagai langkah selanjutnya, kami akan mengadakan sesi onboarding pada:\n\n*Tanggal* : {onboarding_date} secara offline di Yogyakarta\n*Waktu*   : {onboarding_time} WIB\n*Tempat*  : {onboarding_location}\n\nUntuk teman-teman yang akan melakukan konversi SKS, mohon lengkapi informasi berikut:\n\n*abaikan apabila tidak melakukan konversi SKS*\n\n- Durasi magang minimal dari kampus: ... bulan\n- Syarat/dokumen yang dibutuhkan dari Dialogika:\n- Syarat jobdesc tertentu:\n\nJika ada pertanyaan atau hal yang perlu dikonfirmasi, jangan ragu untuk menghubungi kami melalui WhatsApp ini.\n\nSekali lagi, selamat bergabung di keluarga besar Dialogika! Kami tidak sabar untuk memulai perjalanan ini bersamamu.\n\nSalam hangat,\n\nHR Dialogika\n\n*Dimohon membawa materai Rp10.000 & menginstal aplikasi Click-Up & Messenger di Handphone & Laptop*\n\nNoted: Silahkan untuk menghubungi kak Elsa dengan nama FB @Dwiya Elsa Yulianti dengan isi chatnya \"Halo kak, Perkenalkan aku (Nama) dari divisi (.....). Terima kasih kak\"."
        },
        {
            id: "rejected",
            title: "Rejected",
            description: "Template untuk notifikasi kandidat intern ditolak.",
            stage: "decision",
            requiredTokens: ["{candidate_name}"],
            defaultTemplate: "[Recruitment Dialogika Internship - UPDATE]\n\nHalo Kak {candidate_name}!!\n\nTerima kasih banyak atas waktu dan antusiasme yang telah Kakak berikan selama proses seleksi Internship di Dialogika. Kami sangat mengapresiasi usaha dan ketertarikan Kakak untuk bergabung bersama kami.\n\nSetelah melalui proses pertimbangan yang cukup panjang, dengan berat hati kami menginformasikan bahwa saat ini Kakak belum dapat kami lanjutkan ke tahap berikutnya. Keputusan ini tidak mengurangi nilai dan potensi yang Kakak miliki, karena banyak sekali kandidat hebat yang turut berpartisipasi dalam proses seleksi ini.\n\nKami berharap Kakak tetap semangat dalam mengejar kesempatan lainnya, dan semoga di lain waktu kita bisa dipertemukan kembali dalam kesempatan yang berbeda.\n\nTerima kasih sekali lagi atas ketertarikan Kakak kepada Dialogika.\n\nSalam hangat,\nHR Dialogika"
        }
    ],
    team: [
        {
            id: "interview_online",
            title: "Interview Online",
            description: "Template untuk undangan interview online.",
            stage: "interview",
            mode: "online",
            requiredTokens: ["{candidate_name}", "{interview_date}", "{interview_time}", "{meeting_link}"],
            defaultTemplate: "*[REKRUTMEN DIALOGIKA]*\n\nHalo Kak {candidate_name}!\n\nTerima kasih sudah mengikuti tahapan rekrutmen di Dialogika dengan antusias. Selanjutnya, kami ucapkan selamat karena Kakak telah lolos pada tahap screening!\n\nMaka dari itu, kami mengundang Kakak untuk mengikuti tahapan selanjutnya, yaitu wawancara secara online dan verifikasi jadwal yang akan dilaksanakan pada:\n\n*Tanggal* : {interview_date}\n*Waktu*   : {interview_time} WIB\n*Link Meeting* : {meeting_link}\n\nKandidat dimohon untuk bergabung maksimal 5 menit sebelum jadwal wawancara, menggunakan pakaian yang sopan dan rapi, serta memastikan koneksi internet dalam kondisi stabil.\n\nTerima kasih atas perhatiannya.\n\nSalam,\nHuman Resource Dialogika"
        },
        {
            id: "interview_offline",
            title: "Interview Offline",
            description: "Template untuk undangan interview offline.",
            stage: "interview",
            mode: "offline",
            requiredTokens: ["{candidate_name}", "{interview_date}", "{interview_time}", "{interview_location}"],
            defaultTemplate: "*[REKRUTMEN DIALOGIKA]*\n\nHalo Kak {candidate_name}!\n\nTerima kasih sudah mengikuti tahapan rekrutmen di Dialogika dengan antusias. Selanjutnya kami ucapkan selamat karena telah lolos pada tahap screening!\n\nMaka dari itu, kami akan mengundang kakak untuk mengikuti tahapan selanjutnya, yaitu tahap wawancara dan verifikasi jadwal. Pelaksanaan wawancara akan dilakukan secara offline pada:\n\n*Tanggal* : {interview_date}\n*Waktu*   : {interview_time} WIB\n*Lokasi*  : {interview_location}\n\nKandidat dimohon untuk hadir maksimal 5 menit sebelum jadwal wawancara serta menggunakan pakaian yang sopan dan rapi, serta membawa laptop.\n\nTerima kasih atas perhatiannya\n\nSalam,\nHuman Resource Dialogika\n\nMohon untuk konfirmasi kehadiran dengan membalas pesan ini. Terima kasih.\n*reschedule hanya bisa dilakukan 1x maksimal H-1"
        },
        {
            id: "on_job_training_online",
            title: "On Job Training Online",
            description: "Template untuk undangan On Job Training online.",
            stage: "on_job_training",
            mode: "online",
            requiredTokens: ["{candidate_name}", "{ojt_date}", "{ojt_time}", "{meeting_link}"],
            defaultTemplate: "*[REKRUTMEN DIALOGIKA]*\n\nHalo Kak {candidate_name}!\n\nTerima kasih telah mengikuti seluruh tahapan rekrutmen Mentor di Dialogika dengan antusias. Kami mengucapkan selamat karena Kakak telah dinyatakan lolos ke tahap berikutnya, yaitu *On Job Training (OJT)*.\n\nMelalui pesan ini, kami mengundang Kakak untuk mengikuti program OJT yang akan dilaksanakan selama *3 hari* sebagai bagian dari proses penilaian dan pengenalan lingkungan kerja di Dialogika.\n\n*Periode OJT* : {ojt_date}\n*Waktu*       : {ojt_time} WIB\n*Lokasi*      : {meeting_link}\n\nSelama pelaksanaan OJT, peserta diharapkan hadir tepat waktu, menggunakan pakaian yang sopan dan rapi, serta membawa laptop untuk mendukung kegiatan pelatihan dan praktik kerja.\n\nKehadiran dan performa selama OJT akan menjadi salah satu pertimbangan dalam proses evaluasi akhir rekrutmen.\n\nTerima kasih atas perhatian dan kerja samanya.\n\nSalam,\nHuman Resource Dialogika\n\nMohon untuk mengonfirmasi kehadiran dengan membalas pesan ini.\n\n*Reschedule  maksimal H-1 sebelum hari pertama OJT.*"
        },
        {
            id: "on_job_training_offline",
            title: "On Job Training Offline",
            description: "Template untuk undangan On Job Training offline.",
            stage: "on_job_training",
            mode: "offline",
            requiredTokens: ["{candidate_name}", "{ojt_date}", "{ojt_time}", "{ojt_location}"],
            defaultTemplate: "*[REKRUTMEN DIALOGIKA]*\n\nHalo Kak {candidate_name}!\n\nTerima kasih telah mengikuti seluruh tahapan rekrutmen Mentor di Dialogika dengan antusias. Kami mengucapkan selamat karena Kakak telah dinyatakan lolos ke tahap berikutnya, yaitu *On Job Training (OJT)*.\n\nMelalui pesan ini, kami mengundang Kakak untuk mengikuti program OJT yang akan dilaksanakan selama *3 hari* sebagai bagian dari proses penilaian dan pengenalan lingkungan kerja di Dialogika.\n\n*Periode OJT* : {ojt_date}\n*Waktu*       : {ojt_time} WIB\n*Lokasi*      : {ojt_location}\n\nSelama pelaksanaan OJT, peserta diharapkan hadir tepat waktu, menggunakan pakaian yang sopan dan rapi, serta membawa laptop untuk mendukung kegiatan pelatihan dan praktik kerja.\n\nKehadiran dan performa selama OJT akan menjadi salah satu pertimbangan dalam proses evaluasi akhir rekrutmen.\n\nTerima kasih atas perhatian dan kerja samanya.\n\nSalam,\nHuman Resource Dialogika\n\nMohon untuk mengonfirmasi kehadiran dengan membalas pesan ini.\n\n*Reschedule  maksimal H-1 sebelum hari pertama OJT.*"
        },
        {
            id: "accepted",
            title: "Accepted",
            description: "Template untuk notifikasi kandidat diterima.",
            stage: "decision",
            requiredTokens: ["{candidate_name}"],
            defaultTemplate: "*[Acceptance Letter]*\n\nHalo {candidate_name}!\n\nTerima kasih atas partisipasi dan antusiasmenya dalam mengikuti proses rekrutmen Tim Dialogika.\n\nSetelah melalui proses seleksi dan evaluasi, kami dengan senang hati menginformasikan bahwa Kakak diterima sebagai Tim di Dialogika.\nSelamat bergabung bersama tim!\n\nInformasi mengenai jadwal On Boarding dan kelengkapan administrasi akan kami kirimkan dalam waktu dekat.\n\nTerima kasih dan sampai jumpa di hari pertama magang.\n\nSalam hormat,\nHR Dialogika"
        },
        {
            id: "onboarding",
            title: "Onboarding",
            description: "Template untuk undangan onboarding kandidat tim.",
            stage: "onboarding",
            requiredTokens: ["{onboarding_date}", "{onboarding_time}", "{onboarding_location}"],
            defaultTemplate: "*Undangan Onboarding*\n\n*[Recruitment Dialogika - WELCOME!]*\n\nSelamat! Dengan ini kami menginformasikan bahwa kamu telah diterima sebagai Team di Dialogika. Kami sangat senang menyambutmu menjadi bagian dari tim kami.\n\nSebagai langkah selanjutnya, kami akan mengadakan sesi onboarding pada:\n\n*Tanggal* : {onboarding_date} secara offline di Yogyakarta\n*Waktu*   : {onboarding_time} WIB\n*Tempat*  : {onboarding_location}\n\nUntuk teman-teman yang akan melakukan konversi SKS, mohon lengkapi informasi berikut:\n\n*abaikan apabila tidak melakukan konversi SKS*\n\n- Durasi magang minimal dari kampus: ... bulan\n- Syarat/dokumen yang dibutuhkan dari Dialogika:\n- Syarat jobdesc tertentu:\n\nJika ada pertanyaan atau hal yang perlu dikonfirmasi, jangan ragu untuk menghubungi kami melalui WhatsApp ini.\n\nSekali lagi, selamat bergabung di keluarga besar Dialogika! Kami tidak sabar untuk memulai perjalanan ini bersamamu.\n\nSalam hangat,\n\nHR Dialogika\n\n*Dimohon membawa materai Rp10.000 & menginstal aplikasi Click-Up & Discord di Handphone & Laptop*"
        },
        {
            id: "rejected",
            title: "Rejected",
            description: "Template untuk notifikasi kandidat ditolak.",
            stage: "decision",
            requiredTokens: ["{candidate_name}"],
            defaultTemplate: "[Recruitment Dialogika Team - UPDATE]\nHalo Kak {candidate_name}!!\n\nTerima kasih banyak atas waktu dan antusiasme yang telah Kakak berikan selama proses seleksi Tim di Dialogika. Kami sangat mengapresiasi usaha dan ketertarikan Kakak untuk bergabung bersama kami.\n\nSetelah melalui proses pertimbangan yang cukup panjang, dengan berat hati kami menginformasikan bahwa saat ini Kakak belum dapat kami lanjutkan ke tahap berikutnya. Keputusan ini tidak mengurangi nilai dan potensi yang Kakak miliki, karena banyak sekali kandidat hebat yang turut berpartisipasi dalam proses seleksi ini.\n\nKami berharap Kakak tetap semangat dalam mengejar kesempatan lainnya, dan semoga di lain waktu kita bisa dipertemukan kembali dalam kesempatan yang berbeda.\n\nTerima kasih sekali lagi atas ketertarikan Kakak kepada Dialogika.\n\nSalam hangat,\nHR Dialogika"
        }
    ],
    mentor: [
        {
            id: "interview_online",
            title: "Interview Online",
            description: "Template untuk undangan interview online kandidat mentor.",
            stage: "interview",
            mode: "online",
            requiredTokens: ["{candidate_name}", "{interview_date}", "{interview_time}", "{meeting_link}"],
            defaultTemplate: "*[REKRUTMEN MENTOR DIALOGIKA]*\n\nHalo Kak {candidate_name}!\n\nTerima kasih sudah mengikuti proses rekrutmen Mentor di Dialogika. Kami mengapresiasi antusiasme dan ketertarikan Kakak untuk bergabung bersama kami.\n\nKami dengan senang hati menginformasikan bahwa Kakak telah lolos tahap screening dan berhak melanjutkan ke tahap wawancara online yang akan dilaksanakan pada:\n\n*Tanggal* : {interview_date}\n*Waktu* : {interview_time} WIB\n*Link Meeting* : {meeting_link}\n\nMohon bergabung maksimal 5 menit sebelum jadwal wawancara, menggunakan pakaian yang sopan dan rapi, serta memastikan koneksi internet dalam kondisi stabil.\n\nTerima kasih atas perhatiannya.\n\nSalam,\nHuman Resource Dialogika"
        },
        {
            id: "interview_offline",
            title: "Interview Offline",
            description: "Template untuk undangan interview offline kandidat mentor.",
            stage: "interview",
            mode: "offline",
            requiredTokens: ["{candidate_name}", "{interview_date}", "{interview_time}", "{interview_location}"],
            defaultTemplate: "*[REKRUTMEN MENTOR DIALOGIKA]*\n\nHalo Kak {candidate_name}!\n\nTerima kasih telah mengikuti proses rekrutmen Mentor di Dialogika.\n\nKami dengan senang hati menginformasikan bahwa Kakak telah lolos tahap screening dan diundang untuk mengikuti wawancara secara langsung yang akan dilaksanakan pada:\n\n*Tanggal* : {interview_date}\n*Waktu* : {interview_time} WIB\n*Lokasi* : {interview_location}\n\nMohon hadir 10 menit sebelum jadwal yang ditentukan dan menggunakan pakaian yang sopan serta rapi.\n\nJika terdapat kendala kehadiran, mohon segera menghubungi tim Human Resource Dialogika.\n\nTerima kasih.\n\nSalam,\nHuman Resource Dialogika"
        },
        {
            id: "microteaching_online",
            title: "Micro Teaching Online",
            description: "Template untuk undangan Micro Teaching online kandidat mentor.",
            stage: "micro_teaching",
            mode: "online",
            requiredTokens: ["{candidate_name}", "{microteaching_date}", "{microteaching_time}", "{meeting_link}"],
            defaultTemplate: "*[REKRUTMEN MENTOR DIALOGIKA]*\n\nHalo Kak {candidate_name}!\n\nSelamat! Setelah melalui tahap wawancara, Kakak dinyatakan lolos dan berhak melanjutkan ke tahap *Micro Teaching Online*.\n\nTahap ini bertujuan untuk melihat kemampuan Kakak dalam menyampaikan materi dan berinteraksi layaknya seorang mentor.\n\nPelaksanaan micro teaching akan dilakukan pada:\n\n*Tanggal* : {microteaching_date}\n*Waktu* : {microteaching_time} WIB\n*Link Meeting* : {meeting_link}\n\nMohon mempersiapkan materi presentasi sesuai ketentuan yang telah diberikan dan bergabung maksimal 5 menit sebelum sesi dimulai.\n\nKami menantikan penampilan terbaik Kakak.\n\nSalam,\nHuman Resource Dialogika"
        },
        {
            id: "microteaching_offline",
            title: "Micro Teaching Offline",
            description: "Template untuk undangan Micro Teaching offline kandidat mentor.",
            stage: "micro_teaching",
            mode: "offline",
            requiredTokens: ["{candidate_name}", "{microteaching_date}", "{microteaching_time}", "{microteaching_location}"],
            defaultTemplate: "*[REKRUTMEN MENTOR DIALOGIKA]*\n\nHalo Kak {candidate_name}!\n\nSelamat! Setelah melalui tahap wawancara, Kakak dinyatakan lolos dan berhak melanjutkan ke tahap *Micro Teaching Offline*.\n\nPada tahap ini, Kakak akan diminta melakukan simulasi penyampaian materi sebagai mentor secara langsung.\n\nPelaksanaan micro teaching akan dilakukan pada:\n\n*Tanggal* : {microteaching_date}\n*Waktu* : {microteaching_time} WIB\n*Lokasi* : {microteaching_location}\n\nMohon hadir 10 menit sebelum jadwal yang telah ditentukan dan mempersiapkan materi yang akan disampaikan.\n\nTerima kasih dan semoga sukses.\n\nSalam,\nHuman Resource Dialogika"
        },
        {
            id: "accepted",
            title: "Accepted",
            description: "Template untuk notifikasi kandidat mentor diterima.",
            stage: "decision",
            requiredTokens: ["{candidate_name}"],
            defaultTemplate: "*[REKRUTMEN MENTOR DIALOGIKA]*\n\nHalo Kak {candidate_name}!\n\nSelamat!\n\nBerdasarkan seluruh tahapan seleksi yang telah Kakak ikuti, kami dengan senang hati menginformasikan bahwa Kakak *DITERIMA* sebagai bagian dari Mentor Dialogika.\n\nKami mengapresiasi waktu, usaha, dan antusiasme yang telah Kakak tunjukkan selama proses rekrutmen berlangsung.\n\nSelanjutnya, tim Human Resource Dialogika akan menghubungi Kakak terkait proses onboarding, administrasi, serta informasi teknis lainnya.\n\nKami berharap Kakak dapat bertumbuh dan memberikan dampak positif bersama Dialogika.\n\nSelamat bergabung dan sampai bertemu di perjalanan berikutnya!\n\nSalam hangat,\nHuman Resource Dialogika"
        },
        {
            id: "rejected",
            title: "Rejected",
            description: "Template untuk notifikasi kandidat mentor ditolak.",
            stage: "decision",
            requiredTokens: ["{candidate_name}"],
            defaultTemplate: "*[REKRUTMEN MENTOR DIALOGIKA]*\n\nHalo Kak {candidate_name}!\n\nTerima kasih telah meluangkan waktu dan mengikuti seluruh proses rekrutmen Mentor di Dialogika.\n\nSetelah melakukan evaluasi secara menyeluruh terhadap seluruh tahapan seleksi, kami menyampaikan bahwa pada kesempatan kali ini Kakak belum dapat melanjutkan proses rekrutmen Mentor Dialogika.\n\nKeputusan ini tidak mengurangi apresiasi kami terhadap potensi, usaha, dan antusiasme yang telah Kakak tunjukkan selama proses seleksi berlangsung. Proses evaluasi dilakukan berdasarkan berbagai pertimbangan yang disesuaikan dengan kebutuhan posisi saat ini.\n\nKami mengucapkan terima kasih atas ketertarikan Kakak untuk bergabung bersama Dialogika dan berharap pengalaman selama proses rekrutmen ini dapat memberikan manfaat ke depannya.\n\nSemoga sukses untuk perjalanan karier dan pengembangan diri Kakak selanjutnya.\n\nSalam,\nHuman Resource Dialogika"
        }
    ]
};

/**
 * Storage keys per category
 */
const CATEGORY_STORAGE_KEYS = {
    intern: "dialogika_chat_templates_intern_v1",
    team: "dialogika_chat_templates_team_v1",
    mentor: "dialogika_chat_templates_mentor_v1"
};

/**
 * Legacy storage key (mapped to team for backward compatibility)
 */
const LEGACY_STORAGE_KEY = "dialogika_internship_chat_templates_v1";

/**
 * Backward-compatible exports (point to team)
 */
export const TEMPLATE_DEFINITIONS = CATEGORY_TEMPLATE_DEFS.team;
export const TEMPLATE_STORAGE_KEY = LEGACY_STORAGE_KEY;

/**
 * Normalize category name with fallback
 */
function normalizeCategory(category) {
    const cat = (category || "").toString().trim().toLowerCase();
    if (CATEGORY_TEMPLATE_DEFS[cat]) return cat;
    // Map common aliases
    if (cat === "internship") return "intern";
    return "team";
}

/**
 * Get storage key for a category
 */
export function getCategoryStorageKey(category) {
    const cat = normalizeCategory(category);
    return CATEGORY_STORAGE_KEYS[cat] || CATEGORY_STORAGE_KEYS.team;
}

/**
 * Get template definitions for a category
 */
export function getCategoryTemplateDefs(category) {
    const cat = normalizeCategory(category);
    return CATEGORY_TEMPLATE_DEFS[cat] || CATEGORY_TEMPLATE_DEFS.team;
}

/**
 * Build default templates map from definitions array
 */
function buildDefaultTemplatesMap(defs) {
    const defaults = {};
    (defs || []).forEach(def => {
        defaults[def.id] = def.defaultTemplate;
    });
    return defaults;
}

/**
 * Get template definition by ID within a category
 */
export function getTemplateDefinition(templateId, category) {
    const defs = getCategoryTemplateDefs(category);
    return defs.find(def => def.id === templateId) || null;
}

/**
 * Get all stored templates for a category with fallback to defaults
 */
export function getStoredTemplates(category) {
    const cat = normalizeCategory(category);
    const defs = getCategoryTemplateDefs(cat);
    const defaults = buildDefaultTemplatesMap(defs);
    const storageKey = getCategoryStorageKey(cat);
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
            // For team, also check legacy key for backward compatibility
            if (cat === "team") {
                const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
                if (legacyRaw) {
                    const legacyParsed = JSON.parse(legacyRaw);
                    if (legacyParsed && typeof legacyParsed === "object") {
                        Object.keys(defaults).forEach((key) => {
                            const value = (legacyParsed[key] || "").toString().trim();
                            if (value) defaults[key] = value;
                        });
                        // Migrate to new key
                        try { window.localStorage.setItem(storageKey, JSON.stringify(defaults)); } catch (_) {}
                        return defaults;
                    }
                }
            }
            return defaults;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return defaults;

        // Migrate legacy micro_teaching to on_job_training for team
        if (cat === "team") {
            if (parsed.micro_teaching_online && !parsed.on_job_training_online) {
                parsed.on_job_training_online = parsed.micro_teaching_online;
            }
            if (parsed.micro_teaching_offline && !parsed.on_job_training_offline) {
                parsed.on_job_training_offline = parsed.micro_teaching_offline;
            }
        }

        Object.keys(defaults).forEach((key) => {
            const value = (parsed[key] || "").toString().trim();
            if (value) defaults[key] = value;
        });
        return defaults;
    } catch (error) {
        console.warn("Failed to load templates from storage, using defaults", error);
        return defaults;
    }
}

/**
 * Save templates for a category to localStorage
 */
export function saveTemplates(templates, category) {
    const cat = normalizeCategory(category);
    const storageKey = getCategoryStorageKey(cat);
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(templates));
        // Also update legacy key for team
        if (cat === "team") {
            try { window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(templates)); } catch (_) {}
        }
        return true;
    } catch (error) {
        console.error("Failed to save templates to storage", error);
        return false;
    }
}

/**
 * Get templates with metadata for editor
 */
export function getTemplatesWithMetadata(category) {
    const defs = getCategoryTemplateDefs(category);
    const stored = getStoredTemplates(category);
    return defs.map(def => ({
        ...def,
        currentValue: stored[def.id] || def.defaultTemplate
    }));
}

/**
 * Reset templates to defaults for a category
 */
export function resetTemplatesToDefaults(category) {
    const defs = getCategoryTemplateDefs(category);
    const defaults = buildDefaultTemplatesMap(defs);
    return saveTemplates(defaults, category);
}

/**
 * Interpolate template with token values
 */
export function interpolateTemplate(templateText, tokens) {
    const source = (templateText || "").toString();
    return source.replace(/\{([a-z_]+)\}/gi, (fullMatch, tokenName) => {
        const replacement = tokens && Object.prototype.hasOwnProperty.call(tokens, tokenName)
            ? tokens[tokenName]
            : "";
        const nextValue = (replacement || "").toString().trim();
        return nextValue || fullMatch;
    });
}

/**
 * Build WhatsApp message from template ID and tokens
 */
export function buildMessageFromTemplate(templateId, tokens, category) {
    const stored = getStoredTemplates(category);
    const template = stored[templateId];
    if (!template) {
        console.warn(`Template ${templateId} not found in category ${normalizeCategory(category)}, returning null`);
        return null;
    }
    return interpolateTemplate(template, tokens);
}

/**
 * Get template ID for specific stage and mode, category-aware
 */
export function getTemplateIdForStageMode(stage, mode, category) {
    const cat = normalizeCategory(category);
    if (stage === "interview" && mode === "online") return "interview_online";
    if (stage === "interview" && mode === "offline") return "interview_offline";
    // Mentor uses microteaching_* IDs
    if (cat === "mentor") {
        if ((stage === "micro_teaching" || stage === "on_job_training") && mode === "online") return "microteaching_online";
        if ((stage === "micro_teaching" || stage === "on_job_training") && mode === "offline") return "microteaching_offline";
    } else {
        if ((stage === "on_job_training" || stage === "micro_teaching") && mode === "online") return "on_job_training_online";
        if ((stage === "on_job_training" || stage === "micro_teaching") && mode === "offline") return "on_job_training_offline";
    }
    if (stage === "decision" && mode === "accepted") return "accepted";
    if (stage === "decision" && mode === "rejected") return "rejected";
    if (stage === "onboarding") return "onboarding";
    return null;
}

/**
 * List all template IDs for a category
 */
export function getAllTemplateIds(category) {
    const defs = getCategoryTemplateDefs(category);
    return defs.map(def => def.id);
}

/**
 * List templates by stage within a category
 */
export function getTemplatesByStage(stage, category) {
    const defs = getCategoryTemplateDefs(category);
    return defs.filter(def => def.stage === stage);
}

/**
 * Check if template has all required tokens provided
 */
export function validateTemplateTokens(templateId, tokens, category) {
    const def = getTemplateDefinition(templateId, category);
    if (!def) {
        return { isValid: false, missingTokens: [], error: "Template not found" };
    }
    const providedTokens = new Set(Object.keys(tokens || {}));
    const missingTokens = def.requiredTokens.filter(requiredToken => {
        const tokenName = requiredToken.slice(1, -1);
        return !providedTokens.has(tokenName);
    });
    return {
        isValid: missingTokens.length === 0,
        missingTokens,
        requiredTokens: def.requiredTokens
    };
}

/**
 * Get last modified timestamp of templates for a category
 */
export function getTemplatesLastModified(category) {
    try {
        const storageKey = getCategoryStorageKey(category);
        const timestamp = window.localStorage.getItem(storageKey + "_updated_at");
        return timestamp ? parseInt(timestamp, 10) : null;
    } catch (error) {
        return null;
    }
}

/**
 * Set last modified timestamp of templates for a category
 */
export function setTemplatesLastModified(category) {
    try {
        const storageKey = getCategoryStorageKey(category);
        window.localStorage.setItem(storageKey + "_updated_at", Date.now().toString());
    } catch (error) {
        console.warn("Failed to save template modification timestamp", error);
    }
}

/**
 * Export templates as JSON string for a category
 */
export function exportTemplates(category) {
    const templates = getStoredTemplates(category);
    return JSON.stringify(templates, null, 2);
}

/**
 * Import templates from JSON string for a category
 */
export function importTemplates(jsonString, category) {
    try {
        const parsed = JSON.parse(jsonString);
        if (!parsed || typeof parsed !== "object") {
            return { success: false, message: "Invalid JSON format" };
        }
        const result = saveTemplates(parsed, category);
        if (result) {
            setTemplatesLastModified(category);
            return { success: true, message: "Templates imported successfully", templates: parsed };
        }
        return { success: false, message: "Failed to save imported templates" };
    } catch (error) {
        return { success: false, message: `Import error: ${error.message}` };
    }
}
