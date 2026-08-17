import 'package:flutter/material.dart';
import '../models/ai_config.dart';
import '../services/storage_service.dart';
import '../services/auth_service.dart';

class AuthGateView extends StatefulWidget {
  final StorageService storageService;
  final AIConfig config;
  final VoidCallback onAuthenticated;

  const AuthGateView({
    super.key,
    required this.storageService,
    required this.config,
    required this.onAuthenticated,
  });

  @override
  State<AuthGateView> createState() => _AuthGateViewState();
}

class _AuthGateViewState extends State<AuthGateView> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final AuthService _authService = AuthService();
  bool _isLoading = false;
  String? _error;

  void _handleEmailSignIn() async {
    final email = _emailController.text.trim().toLowerCase();
    final password = _passwordController.text;
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Please enter a valid email address.');
      return;
    }
    if (password.isEmpty || password.length < 6) {
      setState(() => _error = 'Password must be at least 6 characters.');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final user = await _authService.login(email);
      widget.config.syncKey = user.userId;
      await widget.storageService.saveConfig(widget.config);
      widget.onAuthenticated();
    } catch (err) {
      setState(() => _error = 'Authentication error: $err');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const creamBg = Color(0xFFFCFBF9);
    const cardBg = Color(0xFFFFFFFF);
    const textPrimary = Color(0xFF1C1917);
    const borderMain = Color(0xFFE6E0D4);

    return Scaffold(
      backgroundColor: creamBg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Minimalist Logo & Brand
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: textPrimary,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'A',
                      style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'ANTRI CODE',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2.0,
                      color: textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Authentication & Cloud Partition Gate',
                    style: TextStyle(fontSize: 12, color: Color(0xFF78716C), fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 32),

                  // Login Container Card
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: borderMain),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Email Field
                        TextField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          decoration: InputDecoration(
                            labelText: 'Work or Personal Email',
                            labelStyle: const TextStyle(fontSize: 12, color: Color(0xFF78716C)),
                            hintText: 'user@example.com',
                            hintStyle: const TextStyle(fontSize: 13),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          ),
                        ),
                        const SizedBox(height: 14),

                        // Password Field
                        TextField(
                          controller: _passwordController,
                          obscureText: true,
                          decoration: InputDecoration(
                            labelText: 'Password (min 6 chars)',
                            labelStyle: const TextStyle(fontSize: 12, color: Color(0xFF78716C)),
                            hintText: '••••••••',
                            hintStyle: const TextStyle(fontSize: 13),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          ),
                        ),
                        const SizedBox(height: 16),

                        if (_error != null) ...[
                          Text(
                            _error!,
                            style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12, fontWeight: FontWeight.w600),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 12),
                        ],

                        ElevatedButton(
                          onPressed: _isLoading ? null : _handleEmailSignIn,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: textPrimary,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          child: _isLoading
                              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Text('Enter Workspace', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    '🔒 Isolated Google Cloud Firestore partitions & Rate-limited anti-abuse shield.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 11, color: Color(0xFFA8A29E)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
