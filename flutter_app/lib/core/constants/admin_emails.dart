/// Single source of truth for hardcoded super-admin accounts.
/// Anywhere the app needs to ask "is this email a master admin?",
/// use [isMasterAdminEmail] instead of repeating the strings.
const List<String> kMasterAdminEmails = [
  'norazrul7@gmail.com',
  'shazaima17@gmail.com',
];

bool isMasterAdminEmail(String? email) {
  final clean = email?.trim().toLowerCase() ?? '';
  return clean.isNotEmpty && kMasterAdminEmails.contains(clean);
}
