function doGet(e) { 
   return ContentService.createTextOutput("Script Aktif."); 
 } 
 
 function doPost(e) { 
   const ssAuthId = "1t0HFkgqVQDUI0Ju50sa0JZrp6pnhXeqBF8R8cvKMTtI"; // Spreadsheet Login 
   const ssProfileId = "1_KGWsIvJAkmVAPa2qA32i-8LnkaVbb_LXw54QhJ8tKk"; // Spreadsheet Profil 
   
   const sheetAuth = SpreadsheetApp.openById(ssAuthId).getSheets()[0]; 
   const sheetProfile = SpreadsheetApp.openById(ssProfileId).getSheets()[0]; 
   
   const emailInput = e.parameter.email; 
   const passwordInput = e.parameter.password; 
   
   const authData = sheetAuth.getDataRange().getValues(); 
   const profileData = sheetProfile.getDataRange().getValues(); 
   
   let userFound = null; 
 
   // 1. Cek Login 
   for (let i = 1; i < authData.length; i++) { 
     // Pastikan perbandingan string aman dengan trim()
     if (String(authData[i][1]).trim() == String(emailInput).trim() && 
         String(authData[i][2]).trim() == String(passwordInput).trim()) { 
       
       userFound = { 
           id: String(authData[i][0]).trim(), // Simpan ID dari Sheet Auth
           email: authData[i][1] 
       }; 
       break; 
     } 
   } 
 
   if (userFound) { 
     // MASALAHNYA DULU DISINI: Objek profile tidak menyertakan ID dari userFound
     let profile = { 
       id: userFound.id,         // <--- TAMBAHAN PENTING: ID User wajib disertakan!
       email: userFound.email,   // <--- Sertakan email juga
       name: "User", 
       photo: "https://i.pravatar.cc/300", 
       role: "Member"            // <--- Frontend butuh 'role' (bukan hanya position)
     }; 
 
     // 2. Cari Data Profil berdasarkan Email 
     for (let j = 1; j < profileData.length; j++) { 
       if (String(profileData[j][4]).trim() == String(emailInput).trim()) { // Kolom E (Email) 
         profile.name = profileData[j][1];   // Kolom B (Name) 
         profile.photo = profileData[j][2];  // Kolom C (Photo Link) 
         
         // Jika ada kolom Role/Position di profile, bisa diambil juga
         // profile.role = profileData[j][5]; 
         break; 
       } 
     } 
 
     return ContentService.createTextOutput(JSON.stringify({ 
       status: "sukses", 
       user: profile // Sekarang objek ini sudah punya .id
     })).setMimeType(ContentService.MimeType.JSON); 
     
   } else { 
     return ContentService.createTextOutput(JSON.stringify({ 
       status: "gagal", 
       message: "Email atau Password Salah" 
     })).setMimeType(ContentService.MimeType.JSON); 
   } 
 }