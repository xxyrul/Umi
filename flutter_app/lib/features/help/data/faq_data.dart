class FaqItem {
  final String question;
  final String answer;

  const FaqItem({
    required this.question,
    required this.answer,
  });
}

const List<FaqItem> kFaqsBM = [
  FaqItem(
    question: 'Bagaimana cara menjana & berkongsi kod jemputan ejen?',
    answer: 'Pentadbir agensi boleh pergi ke Profil > Pusat Pentadbir > Kod Jemputan. Anda boleh menjana kod pantas dan kongsikan terus kepada rakan agensi dengan satu klik.',
  ),
  FaqItem(
    question: 'Bagaimana formula DSR & kelayakan pinjaman dikira?',
    answer: 'Kalkulator DSR Artha mematuhi garis panduan Bank Negara Malaysia (BNM). Ia mengira Nisbah Khidmat Hutang berdasarkan pendapatan bersih bulanan dan komitmen semasa mengikut had ambang bank (sehingga 70-85%).',
  ),
  FaqItem(
    question: 'Bolehkah saya menggunakan aplikasi semasa tiada internet (Offline)?',
    answer: 'Ya! Semua listing dan kes yang pernah dibuka disimpan dalam peranti anda. Anda masih boleh menyemaknya walaupun tiada sambungan internet di tapak projek.',
  ),
  FaqItem(
    question: 'Bagaimana keselamatan maklumat klien & transaksi dilindungi?',
    answer: 'Privasi anda keutamaan kami. Nombor telefon klien, butiran peribadi dan dokumen sulit hanya boleh diakses oleh anda dan pihak pentadbiran agensi yang sah sahaja.',
  ),
  FaqItem(
    question: 'Berapa lama masa diambil untuk permohonan akses ejen disahkan?',
    answer: 'Admin agensi akan menyemak permohonan anda. Biasanya pengesahan akaun selesai dalam tempoh beberapa jam.',
  ),
  FaqItem(
    question: 'Bagaimana cara berkongsi sebut harga pinjaman kepada klien?',
    answer: 'Buka Kalkulator > Tab Bank Loan, tekan butang SALIN SEBUT HARGA. Butiran lengkap bersama anggaran kos guaman dan bayaran bulanan akan disalin terus untuk anda hantar kepada klien.',
  ),
  FaqItem(
    question: 'Di manakah saya boleh menyemak jawapan daripada pihak pembangun?',
    answer: 'Sebarang laporan masalah atau cadangan yang anda hantar boleh disemak status dan jawapan pentadbir di tab "Rekod & Status" di bahagian atas skrin ini.',
  ),
];

const List<FaqItem> kFaqsEN = [
  FaqItem(
    question: 'How do I generate and share agent invite codes?',
    answer: 'Agency admins can navigate to Profile > Admin Hub > Invite Codes. You can generate invite codes and share them instantly with team members.',
  ),
  FaqItem(
    question: 'How is the DSR and loan eligibility calculated?',
    answer: 'The Artha DSR calculator follows Bank Negara Malaysia (BNM) guidelines. It calculates Debt Service Ratio based on net monthly income and existing commitments against bank thresholds (typically 70-85%).',
  ),
  FaqItem(
    question: 'Can I use the app without an internet connection (Offline)?',
    answer: 'Yes! Listings and cases you have previously opened are saved on your device. You can still view and review them even at project sites without internet coverage.',
  ),
  FaqItem(
    question: 'How is client information and transaction data protected?',
    answer: 'Your client data is private and confidential. Phone numbers, transaction details, and sensitive documents can only be accessed by you and authorized agency admins.',
  ),
  FaqItem(
    question: 'How long does agent access approval usually take?',
    answer: 'Your agency admin will review your registration. Verifications are typically approved within a few hours.',
  ),
  FaqItem(
    question: 'How do I share loan quotations with clients?',
    answer: 'Go to Calculator > Bank Loan tab, and tap COPY QUOTATION. The complete breakdown including estimated legal fees and monthly installments is copied so you can send it directly to your client.',
  ),
  FaqItem(
    question: 'Where can I check responses from developers or admins?',
    answer: 'Any bug reports or suggestions you submit can be tracked along with admin responses under the "History & Status" tab at the top of this screen.',
  ),
];
