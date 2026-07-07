class AuthUser {
  final String id;
  final String email;
  final String? name;
  final String role; // OWNER | GUARD

  AuthUser({
    required this.id,
    required this.email,
    this.name,
    required this.role,
  });

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
        id: j['id'] as String,
        email: j['email'] as String,
        name: j['name'] as String?,
        role: j['role'] as String,
      );
}

class AuthResult {
  final String accessToken;
  final String refreshToken;
  final AuthUser user;

  AuthResult({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  factory AuthResult.fromJson(Map<String, dynamic> j) => AuthResult(
        accessToken: j['accessToken'] as String,
        refreshToken: j['refreshToken'] as String,
        user: AuthUser.fromJson(j['user'] as Map<String, dynamic>),
      );
}
