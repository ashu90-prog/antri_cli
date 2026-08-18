import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class UserAccount {
  final String email;
  final String userId;
  final String loggedInAt;

  UserAccount({required this.email, required this.userId, required this.loggedInAt});

  Map<String, dynamic> toJson() => {
        'email': email,
        'userId': userId,
        'loggedInAt': loggedInAt,
      };

  factory UserAccount.fromJson(Map<String, dynamic> json) => UserAccount(
        email: json['email'] ?? '',
        userId: json['userId'] ?? '',
        loggedInAt: json['loggedInAt'] ?? '',
      );
}

class AuthService {
  static const String _keyUser = 'antri_flutter_user_account';

  static String generateUserId(String email) {
    final clean = email.toLowerCase().trim();
    return clean.replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '_');
  }

  Future<UserAccount?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_keyUser);
    if (raw != null) {
      try {
        return UserAccount.fromJson(jsonDecode(raw));
      } catch (_) {}
    }
    return null;
  }

  Future<UserAccount> login(String email, [String? password]) async {
    final cleanEmail = email.toLowerCase().trim();
    final userId = generateUserId(cleanEmail);
    final user = UserAccount(
      email: cleanEmail,
      userId: userId,
      loggedInAt: DateTime.now().toIso8601String(),
    );

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyUser, jsonEncode(user.toJson()));
    return user;
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyUser);
  }
}
