import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'models/ai_config.dart';
import 'services/ai_service.dart';
import 'services/storage_service.dart';
import 'views/agent_studio_view.dart';
import 'views/dialectic_arena_view.dart';
import 'views/goal_loop_view.dart';
import 'views/profiles_view.dart';
import 'views/settings_view.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AntriFlutterApp());
}

class AntriFlutterApp extends StatelessWidget {
  const AntriFlutterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ANTRI Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFFCFBF9),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1C1917),
          primary: const Color(0xFF1C1917),
          surface: const Color(0xFFFFFFFF),
        ),
        textTheme: GoogleFonts.plusJakartaSansTextTheme(
          Theme.of(context).textTheme,
        ),
      ),
      home: const MainNavigationScreen(),
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;
  final StorageService _storageService = StorageService();
  final AIService _aiService = AIService();
  AIConfig _config = AIConfig();
  bool _isReady = false;

  @override
  void initState() {
    super.initState();
    _initApp();
  }

  Future<void> _initApp() async {
    final cfg = await _storageService.loadConfig();
    setState(() {
      _config = cfg;
      _isReady = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_isReady) {
      return const Scaffold(
        backgroundColor: Color(0xFFFCFBF9),
        body: Center(child: CircularProgressIndicator(color: Color(0xFF1C1917))),
      );
    }

    final views = [
      AgentStudioView(
        config: _config,
        storageService: _storageService,
        aiService: _aiService,
        onConfigChanged: () => setState(() {}),
      ),
      DialecticArenaView(config: _config, aiService: _aiService),
      GoalLoopView(config: _config, aiService: _aiService),
      ProfilesView(
        config: _config,
        storageService: _storageService,
        onProfileChanged: () => setState(() {}),
      ),
      SettingsView(
        config: _config,
        storageService: _storageService,
        onConfigSaved: () => setState(() {}),
      ),
    ];

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: views,
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Color(0xFFF7F4EE),
          border: Border(top: BorderSide(color: Color(0xFFE6E0D4))),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (idx) => setState(() => _currentIndex = idx),
          backgroundColor: const Color(0xFFF7F4EE),
          selectedItemColor: const Color(0xFF1C1917),
          unselectedItemColor: const Color(0xFF8C827A),
          type: BottomNavigationBarType.fixed,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 11),
          elevation: 0,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.chat_bubble_outline, size: 20),
              activeIcon: Icon(Icons.chat_bubble, size: 20),
              label: 'Studio',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.compare_arrows_outlined, size: 20),
              activeIcon: Icon(Icons.compare_arrows, size: 20),
              label: 'Debate',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.track_changes_outlined, size: 20),
              activeIcon: Icon(Icons.track_changes, size: 20),
              label: 'Goal',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline, size: 20),
              activeIcon: Icon(Icons.person, size: 20),
              label: 'Profile',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.settings_outlined, size: 20),
              activeIcon: Icon(Icons.settings, size: 20),
              label: 'Settings',
            ),
          ],
        ),
      ),
    );
  }
}
